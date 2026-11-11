const env = require('../../config/env');
const Invoice = require('./invoice.model');
const IntegrationLog = require('./integration-log.model');
const billport = require('./billport.client');
const { advanceStatus, mapExternalStatus } = require('./invoice-status.service');

/**
 * Self-healing: webhooks get lost. Any pushed invoice that has sat in a non-final status
 * for more than N minutes is checked against BillPort and repaired.
 */
async function runReconciliation() {
  const cutoff = new Date(Date.now() - env.reconcile.staleMinutes * 60_000);
  const stuck = await Invoice.find({
    pushStatus: 'succeeded',
    status: { $in: ['pending', 'sent', 'viewed'] },
    statusUpdatedAt: { $lt: cutoff },
    $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lt: cutoff } }],
  })
    .limit(20)
    .lean();

  for (const invoice of stuck) await reconcileOne(invoice);
}

async function reconcileOne(invoice) {
  const result = await billport.getInvoice(invoice.externalId);
  await Invoice.updateOne({ _id: invoice._id }, { lastReconciledAt: new Date() });

  let outcome;
  if (!result.ok) {
    outcome = 'lookup_failed';
  } else {
    const target = mapExternalStatus(result.body.status);
    // same forward-only rule as webhooks: can never move an invoice backwards
    const updated = await advanceStatus({ _id: invoice._id }, target);
    outcome = updated ? `repaired ${invoice.status} -> ${target}` : `in_sync (${invoice.status})`;
  }

  await IntegrationLog.create({
    invoiceId: invoice._id,
    externalId: invoice.externalId,
    direction: 'outbound',
    action: 'reconcile',
    request: { method: 'GET', externalId: invoice.externalId },
    response: { status: result.status, body: result.body },
    outcome,
    error: result.error,
    durationMs: result.durationMs,
  });
  console.log(`[reconcile] ${invoice.number}: ${outcome}`);
}

module.exports = { runReconciliation };
