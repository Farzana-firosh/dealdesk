const Invoice = require('./invoice.model');
const Customer = require('../customers/customer.model');
const { publish, EVENTS } = require('../../common/events');

const STATUS_MAP = { QUEUED: 'pending', SENT: 'sent', VIEWED: 'viewed', PAID: 'paid', FAILED: 'failed' };
const RANK = { pending: 0, sent: 1, viewed: 2, paid: 3, failed: 3 };

// Statuses an invoice may move *from* to reach `target`. Only forward moves are allowed,
// and cancelled / final invoices never appear here, so they can never change again.
const statusesBelow = (target) => Object.keys(RANK).filter((s) => RANK[s] < RANK[target]);

/**
 * The single place an invoice status changes. The guard is inside the update filter,
 * so of two concurrent writers (webhook + reconciliation) only one can apply a transition.
 */
async function advanceStatus(filter, target, extra = {}) {
  const invoice = await Invoice.findOneAndUpdate(
    { ...filter, status: { $in: statusesBelow(target) } },
    { $set: { status: target, statusUpdatedAt: new Date(), ...extra } },
    { new: true },
  );
  if (!invoice) return null;

  // runs once per invoice: only the update that moved it into `paid` gets here
  if (target === 'paid') {
    await Customer.updateOne({ _id: invoice.customerId }, { $inc: { outstandingBalance: -invoice.amount } });
  }

  publish(EVENTS.INVOICE_STATUS_CHANGED, {
    invoiceId: String(invoice._id),
    number: invoice.number,
    dealId: String(invoice.dealId),
    ownerId: String(invoice.ownerId),
    status: invoice.status,
  });
  return invoice;
}

const mapExternalStatus = (external) => STATUS_MAP[external];

module.exports = { advanceStatus, mapExternalStatus };
