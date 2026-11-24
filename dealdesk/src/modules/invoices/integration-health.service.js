const env = require('../../config/env');
const Invoice = require('./invoice.model');
const IntegrationLog = require('./integration-log.model');
const WebhookEvent = require('./webhook-event.model');

const WINDOW_HOURS = 24;
const FAILED_SHOWN = 10;
const MIN_PUSH_SUCCESS = 80; // % of push attempts in the window; below this the link counts as degraded

// Log outcomes carry details ("retry_scheduled_in_4s", "repaired sent -> paid"), so they are
// bucketed by prefix. Anything unrecognised is counted as "other" rather than dropped.
const BUCKETS = {
  push: [['success', 'succeeded'], ['retry_scheduled', 'retried'], ['failed_terminal', 'failed'], ['cancelled_during_push', 'cancelled']],
  webhook: [['applied', 'applied'], ['duplicate_ignored', 'duplicate'], ['stale_ignored', 'stale'], ['rejected_', 'rejected'], ['unknown_invoice', 'unknownInvoice']],
  reconcile: [['repaired', 'repaired'], ['in_sync', 'inSync'], ['lookup_failed', 'failed']],
};

const bucketOf = (action, outcome) => BUCKETS[action]?.find(([prefix]) => outcome.startsWith(prefix))?.[1] ?? 'other';
const emptyCounts = (action) => Object.fromEntries([...BUCKETS[action].map(([, name]) => [name, 0]), ['other', 0]]);

/**
 * BillPort link health across every invoice: the push queue right now, what happened in the
 * last 24 hours, and plain-language reasons when something needs a look.
 */
async function getHealth(now = new Date()) {
  const since = new Date(now - WINDOW_HOURS * 3600_000);
  const staleCutoff = new Date(now - env.reconcile.staleMinutes * 60_000);

  const [queue, failedInvoices, outcomes, lastSeen, webhooksWaiting, awaitingReconcile] = await Promise.all([
    Invoice.aggregate([{ $group: { _id: '$pushStatus', count: { $sum: 1 } } }]),
    Invoice.find({ pushStatus: 'failed' }, 'number amount currency pushAttempts pushError updatedAt')
      .sort({ updatedAt: -1 }).limit(FAILED_SHOWN).lean(),
    IntegrationLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { action: '$action', outcome: '$outcome' }, count: { $sum: 1 }, totalMs: { $sum: { $ifNull: ['$durationMs', 0] } } } },
    ]),
    IntegrationLog.aggregate([{ $group: { _id: '$action', at: { $max: '$createdAt' } } }]),
    WebhookEvent.countDocuments({ state: 'received' }),
    Invoice.countDocuments({ pushStatus: 'succeeded', status: { $in: ['pending', 'sent', 'viewed'] }, statusUpdatedAt: { $lt: staleCutoff } }),
  ]);

  const counts = { push: emptyCounts('push'), webhook: emptyCounts('webhook'), reconcile: emptyCounts('reconcile') };
  let pushMs = 0;
  outcomes.forEach(({ _id, count, totalMs }) => {
    if (!counts[_id.action]) return;
    counts[_id.action][bucketOf(_id.action, _id.outcome)] += count;
    if (_id.action === 'push') pushMs += totalMs;
  });

  const pushAttempts = Object.values(counts.push).reduce((a, b) => a + b, 0);
  const pushQueue = Object.fromEntries(Invoice.PUSH_STATUSES.map((s) => [s, 0]));
  queue.forEach(({ _id, count }) => { pushQueue[_id] = count; });
  const successRate = pushAttempts ? Math.round((counts.push.succeeded / pushAttempts) * 100) : null;

  const reasons = [];
  if (pushQueue.failed) {
    reasons.push(pushQueue.failed === 1
      ? '1 invoice failed to reach BillPort and needs a manual retry'
      : `${pushQueue.failed} invoices failed to reach BillPort and need a manual retry`);
  }
  if (successRate !== null && successRate < MIN_PUSH_SUCCESS) reasons.push(`Only ${successRate}% of push attempts succeeded in the last ${WINDOW_HOURS} hours`);
  if (counts.webhook.rejected) reasons.push(`${counts.webhook.rejected} webhook${counts.webhook.rejected === 1 ? ' was' : 's were'} rejected (bad signature or malformed)`);
  if (counts.reconcile.failed) reasons.push(`${counts.reconcile.failed} reconcile lookup${counts.reconcile.failed === 1 ? '' : 's'} failed`);

  return {
    status: reasons.length ? 'degraded' : 'ok',
    reasons,
    windowHours: WINDOW_HOURS,
    pushQueue,
    push: { ...counts.push, attempts: pushAttempts, successRate, avgMs: pushAttempts ? Math.round(pushMs / pushAttempts) : null },
    webhook: counts.webhook,
    reconcile: counts.reconcile,
    webhooksWaiting,
    awaitingReconcile,
    lastActivity: Object.fromEntries(['push', 'webhook', 'reconcile'].map((a) => [a, lastSeen.find((l) => l._id === a)?.at ?? null])),
    failedInvoices,
  };
}

module.exports = { getHealth };
