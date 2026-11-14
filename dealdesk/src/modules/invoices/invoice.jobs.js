const env = require('../../config/env');
const logger = require('../../common/logger');
const { runEvery } = require('../../common/utils/interval');
const { runPushCycle } = require('./invoice-push.job');
const { runReconciliation } = require('./reconcile.job');
const { sweepPendingEvents } = require('./webhook.service');

function startInvoiceJobs() {
  runEvery('push', env.push.pollIntervalMs, runPushCycle);
  runEvery('webhook-sweep', 5000, sweepPendingEvents);
  runEvery('reconcile', env.reconcile.intervalMs, runReconciliation);
  logger.info(
    { pushEveryMs: env.push.pollIntervalMs, reconcileEveryMs: env.reconcile.intervalMs, staleMinutes: env.reconcile.staleMinutes },
    'invoice jobs started',
  );
}

module.exports = { startInvoiceJobs };
