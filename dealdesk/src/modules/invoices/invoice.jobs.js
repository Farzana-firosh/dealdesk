const env = require('../../config/env');
const { runEvery } = require('../../common/utils/interval');
const { runPushCycle } = require('./invoice-push.job');
const { runReconciliation } = require('./reconcile.job');
const { sweepPendingEvents } = require('./webhook.service');

function startInvoiceJobs() {
  runEvery('push', env.push.pollIntervalMs, runPushCycle);
  runEvery('webhook-sweep', 5000, sweepPendingEvents);
  runEvery('reconcile', env.reconcile.intervalMs, runReconciliation);
  console.log(`[jobs] push every ${env.push.pollIntervalMs}ms, reconcile every ${env.reconcile.intervalMs}ms (stale after ${env.reconcile.staleMinutes} min)`);
}

module.exports = { startInvoiceJobs };
