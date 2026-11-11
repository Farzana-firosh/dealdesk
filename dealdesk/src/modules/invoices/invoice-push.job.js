const env = require('../../config/env');
const Invoice = require('./invoice.model');
const IntegrationLog = require('./integration-log.model');
const billport = require('./billport.client');

const LOCK_MS = env.billport.timeoutMs * 3; // a crashed worker's claim expires after this

// 2s, 4s, 8s ... capped, with ±20% jitter so many failed invoices don't retry in lockstep
function backoffMs(attempt) {
  const base = Math.min(env.push.baseDelayMs * 2 ** (attempt - 1), env.push.maxDelayMs);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

// Atomically claim one due invoice, so two workers can never push the same invoice at once.
function claimNext() {
  const now = new Date();
  return Invoice.findOneAndUpdate(
    {
      pushStatus: { $in: ['queued', 'retrying'] },
      nextPushAt: { $lte: now },
      $or: [{ pushLockedUntil: null }, { pushLockedUntil: { $lt: now } }],
    },
    { $set: { pushLockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { pushAttempts: 1 } },
    { sort: { nextPushAt: 1 }, returnDocument: 'after' },
  );
}

// 4xx (other than 408/429) means our request is wrong; retrying the same request will not help.
const isRetryable = (status) => status === null || status >= 500 || status === 408 || status === 429;

async function pushOne(invoice) {
  const payload = { reference: invoice.number, amount: invoice.amount, currency: invoice.currency };
  const result = await billport.createInvoice(payload, invoice.idempotencyKey);
  const attempt = invoice.pushAttempts;

  let update;
  let outcome;
  if (result.ok) {
    outcome = 'success';
    update = { pushStatus: 'succeeded', externalId: result.body.externalId, pushError: null, statusUpdatedAt: new Date() };
  } else if (isRetryable(result.status) && attempt < env.push.maxAttempts) {
    const delay = backoffMs(attempt);
    outcome = `retry_scheduled_in_${Math.round(delay / 1000)}s`;
    update = { pushStatus: 'retrying', nextPushAt: new Date(Date.now() + delay), pushError: result.error || `HTTP ${result.status}` };
  } else {
    outcome = 'failed_terminal';
    update = { pushStatus: 'failed', pushError: result.error || `HTTP ${result.status}` };
  }

  await Invoice.updateOne({ _id: invoice._id }, { $set: { ...update, pushLockedUntil: null } });
  await IntegrationLog.create({
    invoiceId: invoice._id,
    externalId: result.body?.externalId,
    direction: 'outbound',
    action: 'push',
    request: { attempt, idempotencyKey: invoice.idempotencyKey, payload },
    response: { status: result.status, body: result.body },
    outcome,
    error: result.error,
    durationMs: result.durationMs,
  });
  console.log(`[push] ${invoice.number} attempt ${attempt}: ${result.ok ? 'ok' : result.error || result.status} -> ${outcome}`);
}

async function runPushCycle() {
  for (let invoice = await claimNext(); invoice; invoice = await claimNext()) {
    await pushOne(invoice);
  }
}

module.exports = { runPushCycle, backoffMs };
