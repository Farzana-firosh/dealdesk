const crypto = require('crypto');
const Deal = require('../deals/deal.model');
const Customer = require('../customers/customer.model');
const Sale = require('./sale.model');
const Invoice = require('./invoice.model');
const IntegrationLog = require('./integration-log.model');
const AppError = require('../../common/errors/AppError');
const { scopeFilter } = require('../auth/scope');
const { paginate } = require('../../common/utils/paginate');

const invoiceNumber = () => `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

async function findOrCreateSale(deal, user) {
  const existing = await Sale.findOne({ dealId: deal._id });
  if (existing) return existing;
  try {
    return await Sale.create({
      dealId: deal._id,
      customerId: deal.customerId,
      ownerId: deal.ownerId,
      branchId: deal.branchId,
      amount: deal.total,
      createdBy: user._id,
    });
  } catch (err) {
    if (err.code === 11000) throw AppError.conflict('Deal is already being converted');
    throw err;
  }
}

/**
 * Won deal -> sale -> invoice, all local. BillPort is not called here: the invoice is
 * queued for the push worker, so converting never fails because BillPort is down.
 * Re-running after a partial failure completes the missing piece instead of duplicating it.
 */
async function convertDeal(user, scope, dealId) {
  const deal = await Deal.findOne({ _id: dealId, ...scopeFilter(user, scope) });
  if (!deal) throw AppError.notFound('Deal not found');
  if (deal.status !== 'won') throw AppError.conflict(`Deal is ${deal.status}; only won deals can be converted`);

  const sale = await findOrCreateSale(deal, user);
  if (await Invoice.exists({ saleId: sale._id })) throw AppError.conflict('Deal already converted');

  let invoice;
  try {
    invoice = await Invoice.create({
      number: invoiceNumber(),
      saleId: sale._id,
      dealId: deal._id,
      customerId: deal.customerId,
      ownerId: deal.ownerId,
      branchId: deal.branchId,
      amount: sale.amount,
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (err) {
    if (err.code === 11000) throw AppError.conflict('Deal already converted');
    throw err;
  }

  await Customer.updateOne({ _id: deal.customerId }, { $inc: { outstandingBalance: invoice.amount } });
  return { sale, invoice };
}

const OPEN_STATUSES = ['pending', 'sent', 'viewed'];

// Headline numbers over every invoice in scope (not just the current page or status filter).
async function invoiceSummary(scoped) {
  const [row] = await Invoice.aggregate([
    { $match: scoped },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        openCount: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
        openAmount: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, '$amount', 0] } },
        failedPush: { $sum: { $cond: [{ $eq: ['$pushStatus', 'failed'] }, 1, 0] } },
      },
    },
  ]);
  return {
    total: row?.total ?? 0,
    paid: row?.paid ?? 0,
    outstanding: { count: row?.openCount ?? 0, amount: row?.openAmount ?? 0 },
    failedPush: row?.failedPush ?? 0,
  };
}

// One page of the invoices in scope, newest first, plus the summary for the stat cards.
async function listInvoices(user, scope, { status, page, limit }) {
  const scoped = scopeFilter(user, scope);
  // only a known status string reaches the query (a repeated ?status= would arrive as an array)
  const filter = { ...scoped, ...(Invoice.INVOICE_STATUSES.includes(status) && { status }) };
  const query = Invoice.find(filter).sort({ createdAt: -1, _id: -1 }).populate('customerId', 'name outstandingBalance');
  const [result, summary] = await Promise.all([paginate(query, Invoice, filter, { page, limit }), invoiceSummary(scoped)]);
  return { ...result, summary };
}

async function getInvoice(user, scope, id) {
  const invoice = await Invoice.findOne({ _id: id, ...scopeFilter(user, scope) })
    .populate('customerId', 'name outstandingBalance')
    .populate('dealId', 'title')
    .lean();
  if (!invoice) throw AppError.notFound('Invoice not found');
  return invoice;
}

async function getLogs(user, scope, id) {
  const invoice = await getInvoice(user, scope, id);
  return IntegrationLog.find({ $or: [{ invoiceId: invoice._id }, ...(invoice.externalId ? [{ externalId: invoice.externalId }] : [])] })
    .sort({ createdAt: 1 })
    .lean();
}

// Manual recovery for the terminal failed state.
async function retryPush(user, scope, id) {
  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, pushStatus: 'failed', ...scopeFilter(user, scope) },
    { pushStatus: 'queued', pushAttempts: 0, nextPushAt: new Date(), pushError: null },
    { returnDocument: 'after' },
  );
  if (!invoice) throw AppError.conflict('Only invoices whose push has failed can be retried');
  return invoice;
}

async function cancelInvoice(user, scope, id) {
  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, status: { $in: ['pending', 'sent', 'viewed'] }, ...scopeFilter(user, scope) },
    { status: 'cancelled', statusUpdatedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!invoice) throw AppError.conflict('Invoice not found or already final');

  // stop the worker if BillPort never received it
  await Invoice.updateOne({ _id: invoice._id, pushStatus: { $in: ['queued', 'retrying'] } }, { pushStatus: 'cancelled' });
  await Customer.updateOne({ _id: invoice.customerId }, { $inc: { outstandingBalance: -invoice.amount } });
  return invoice;
}

module.exports = { convertDeal, listInvoices, getInvoice, getLogs, retryPush, cancelInvoice };
