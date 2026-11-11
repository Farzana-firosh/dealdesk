const crypto = require('crypto');
const config = require('./config');
const { chaos } = config;
const { Invoice, Delivery } = require('./models');
const { sign } = require('./hmac');

const NEXT = { QUEUED: 'SENT', SENT: 'VIEWED', VIEWED: null }; // VIEWED -> PAID or FAILED
const chance = (rate) => Math.random() < rate;
const randomStepMs = () => (chaos.minStepSec + Math.random() * (chaos.maxStepSec - chaos.minStepSec)) * 1000;

function nextStatus(current) {
  if (current !== 'VIEWED') return NEXT[current];
  return chance(chaos.paidRate) ? 'PAID' : 'FAILED';
}

async function scheduleWebhook(invoice, sendAt) {
  const body = {
    eventId: crypto.randomUUID(),
    externalId: invoice.externalId,
    status: invoice.status,
    sequence: invoice.sequence,
    occurredAt: invoice.updatedAt.toISOString(),
  };
  const base = { eventId: body.eventId, externalId: invoice.externalId, body, sendAt, tamper: chance(chaos.badSignatureRate) };
  await Delivery.create(base);

  if (chance(chaos.duplicateRate)) {
    await Delivery.create({ ...base, tamper: false, duplicate: true, sendAt: new Date(sendAt.getTime() + 1000 + Math.random() * 2000) });
  }
}

// Moves invoices one step along QUEUED -> SENT -> VIEWED -> PAID/FAILED.
async function advanceDueInvoices() {
  const due = await Invoice.find({ status: { $nin: ['PAID', 'FAILED'] }, nextTransitionAt: { $lte: new Date() } }).limit(50);

  for (const invoice of due) {
    const status = nextStatus(invoice.status);
    const final = status === 'PAID' || status === 'FAILED';
    const nextTransitionAt = final ? null : new Date(Date.now() + randomStepMs());

    const updated = await Invoice.findOneAndUpdate(
      { _id: invoice._id, status: invoice.status },
      { status, $inc: { sequence: 1 }, nextTransitionAt },
      { returnDocument: 'after' },
    );
    if (!updated) continue;

    // out of order: hold VIEWED back until after the final event has been sent
    const holdBack = status === 'VIEWED' && chance(chaos.outOfOrderRate);
    const sendAt = holdBack ? new Date(nextTransitionAt.getTime() + 3000) : new Date();
    await scheduleWebhook(updated, sendAt);
    console.log(`[billport] ${updated.externalId} -> ${status} (seq ${updated.sequence})${holdBack ? ' [held back]' : ''}`);
  }
}

async function deliver(delivery) {
  const raw = JSON.stringify(delivery.body);
  const secret = delivery.tamper && delivery.attempts === 0 ? 'wrong-secret' : config.secret;

  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': sign(raw, secret) },
      body: raw,
      signal: AbortSignal.timeout(config.webhookTimeoutMs),
    });
    return { ok: res.ok, info: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, info: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

async function sendDueWebhooks() {
  for (;;) {
    const delivery = await Delivery.findOneAndUpdate(
      { state: 'pending', sendAt: { $lte: new Date() } },
      { state: 'sending' },
      { sort: { sendAt: 1 }, returnDocument: 'after' },
    );
    if (!delivery) return;

    if (!chaos.webhooksEnabled) {
      await Delivery.updateOne({ _id: delivery._id }, { state: 'dropped' });
      console.log(`[billport] webhook DROPPED ${delivery.body.status} for ${delivery.externalId}`);
      continue;
    }

    const { ok, info } = await deliver(delivery);
    const attempts = delivery.attempts + 1;
    const label = `${delivery.body.status} seq ${delivery.body.sequence}${delivery.duplicate ? ' [dup]' : ''}${delivery.tamper && attempts === 1 ? ' [bad sig]' : ''}`;
    console.log(`[billport] webhook ${label} -> ${info}`);

    const retry = !ok && attempts < config.webhookMaxAttempts;
    await Delivery.updateOne(
      { _id: delivery._id },
      {
        attempts,
        lastResponse: info,
        state: ok ? 'delivered' : retry ? 'pending' : 'failed',
        ...(retry && { sendAt: new Date(Date.now() + 2 ** attempts * 1000) }),
      },
    );
  }
}

function every(ms, fn) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error('[billport] background error', err.message);
    } finally {
      running = false;
    }
  }, ms);
}

function startLifecycle() {
  every(1000, advanceDueInvoices);
  every(500, sendDueWebhooks);
}

module.exports = { startLifecycle, randomStepMs };
