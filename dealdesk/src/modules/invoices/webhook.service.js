const env = require('../../config/env');
const { verify } = require('../../common/utils/hmac');
const WebhookEvent = require('./webhook-event.model');
const IntegrationLog = require('./integration-log.model');
const Invoice = require('./invoice.model');
const { advanceStatus, mapExternalStatus } = require('./invoice-status.service');

// An event for an invoice we don't know yet (webhook beat our push response) is retried for a while.
const UNKNOWN_INVOICE_MAX_ATTEMPTS = 20;

const log = (event, outcome, extra = {}) =>
  IntegrationLog.create({
    direction: 'inbound',
    action: 'webhook',
    eventId: event?.eventId,
    externalId: event?.externalId,
    request: event,
    outcome,
    ...extra,
  });

function parseEvent(raw) {
  try {
    const e = JSON.parse(raw.toString('utf8'));
    const valid = e.eventId && e.externalId && mapExternalStatus(e.status) && Number.isInteger(e.sequence);
    return valid ? e : null;
  } catch {
    return null;
  }
}

/**
 * Called by the route with the *raw* body. Returns the HTTP status to answer with.
 * The only DB work done inline is one insert into the inbox (needed for dedup);
 * applying the event happens after the 200 has been sent.
 */
async function receive(rawBody, signature) {
  if (!verify(rawBody, signature, env.billport.secret)) {
    await log(null, 'rejected_invalid_signature', { request: { raw: rawBody.toString('utf8') }, response: { status: 401 } });
    return { status: 401 };
  }

  const event = parseEvent(rawBody);
  if (!event) {
    await log(null, 'rejected_malformed', { request: { raw: rawBody.toString('utf8') }, response: { status: 400 } });
    return { status: 400 };
  }

  try {
    const stored = await WebhookEvent.create({ ...event, payload: event });
    return { status: 200, eventId: stored._id };
  } catch (err) {
    if (err.code !== 11000) throw err;
    await log(event, 'duplicate_ignored', { response: { status: 200 } });
    return { status: 200 };
  }
}

async function applyEvent(eventDoc) {
  const target = mapExternalStatus(eventDoc.status);
  const updated = await advanceStatus(
    { externalId: eventDoc.externalId, lastSequence: { $lt: eventDoc.sequence } },
    target,
    { lastSequence: eventDoc.sequence },
  );
  if (updated) return { state: 'processed', outcome: 'applied', invoiceId: updated._id };

  const invoice = await Invoice.findOne({ externalId: eventDoc.externalId }, 'status lastSequence').lean();
  if (invoice) {
    return { state: 'ignored', outcome: `stale_ignored (invoice is ${invoice.status}, seq ${invoice.lastSequence})`, invoiceId: invoice._id };
  }
  return eventDoc.attempts + 1 >= UNKNOWN_INVOICE_MAX_ATTEMPTS
    ? { state: 'gave_up', outcome: 'unknown_invoice_gave_up' }
    : { state: 'received', outcome: 'unknown_invoice_will_retry' };
}

async function processEvent(id) {
  // claim: bump attempts only if still unprocessed, so the sweep and the fast path don't double-apply
  const eventDoc = await WebhookEvent.findOneAndUpdate(
    { _id: id, state: 'received' },
    { $inc: { attempts: 1 }, $set: { state: 'processing' } },
    { new: true },
  );
  if (!eventDoc) return;

  try {
    const result = await applyEvent(eventDoc);
    await WebhookEvent.updateOne({ _id: id }, { state: result.state, processedAt: new Date() });
    await log(eventDoc.payload, result.outcome, { invoiceId: result.invoiceId });
  } catch (err) {
    await WebhookEvent.updateOne({ _id: id }, { state: 'received' });
    throw err;
  }
}

// Safety net: picks up events whose fast-path processing never ran (crash) or that wait for an unknown invoice.
async function sweepPendingEvents() {
  const staleProcessing = new Date(Date.now() - 30_000);
  await WebhookEvent.updateMany({ state: 'processing', updatedAt: { $lt: staleProcessing } }, { state: 'received' });

  const pending = await WebhookEvent.find({ state: 'received', updatedAt: { $lt: new Date(Date.now() - 3000) } }, '_id')
    .sort({ sequence: 1 })
    .limit(50)
    .lean();
  for (const e of pending) await processEvent(e._id);
}

module.exports = { receive, processEvent, sweepPendingEvents };
