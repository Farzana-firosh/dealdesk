const crypto = require('crypto');
const { describe, test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Invoice = require('../src/modules/invoices/invoice.model');
const Customer = require('../src/modules/customers/customer.model');
const WebhookEvent = require('../src/modules/invoices/webhook-event.model');
const IntegrationLog = require('../src/modules/invoices/integration-log.model');
const billport = require('../src/modules/invoices/billport.client');
const { runPushCycle } = require('../src/modules/invoices/invoice-push.job');
const { runReconciliation } = require('../src/modules/invoices/reconcile.job');
const { sweepPendingEvents } = require('../src/modules/invoices/webhook.service');
const { app, useDatabase, loginAll, createDeal, signedWebhook } = require('./helpers');

useDatabase();
afterEach(() => mock.restoreAll());

/** A converted invoice that BillPort has accepted, so it has an externalId. */
async function pushedInvoice(as, externalId = `bp_${crypto.randomUUID()}`) {
  const deal = await createDeal(as, 'execA');
  await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 5 });
  const { invoice } = (await as('finance').post(`/api/deals/${deal._id}/convert`)).body;
  mock.method(billport, 'createInvoice', async () => ({ ok: true, status: 201, body: { externalId, status: 'QUEUED' } }));
  await runPushCycle();
  return Invoice.findById(invoice._id).lean();
}

const event = (externalId, status, sequence, eventId = crypto.randomUUID()) => ({
  eventId, externalId, status, sequence, occurredAt: new Date().toISOString(),
});

// The webhook is applied after the 200 is sent; wait until no event is mid-processing.
async function settle() {
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (!(await WebhookEvent.exists({ $or: [{ state: 'processing' }, { state: 'received', attempts: 0 }] }))) return;
  }
  throw new Error('webhook events did not settle');
}

async function deliver(...events) {
  const responses = [];
  for (const e of events) {
    responses.push(await signedWebhook(e));
    await settle();
  }
  return responses;
}

const statusOf = async (id) => (await Invoice.findById(id).lean()).status;

describe('signature verification', () => {
  test('a bad signature is a 401 and the raw body is not stored (regression)', async () => {
    const body = JSON.stringify({ ...event('bp_x', 'PAID', 1), padding: 'A'.repeat(50_000) });
    const res = await request(app).post('/webhooks/billport').set('Content-Type', 'application/json').set('X-Signature', 'deadbeef').send(body);
    assert.equal(res.status, 401);
    assert.equal(await WebhookEvent.countDocuments(), 0);

    const log = await IntegrationLog.findOne({ outcome: 'rejected_invalid_signature' }).lean();
    assert.ok(log, 'the rejection is still logged');
    assert.equal(log.request.raw, undefined);
    assert.equal(log.request.bytes, Buffer.byteLength(body));
    assert.match(log.request.sha256, /^[0-9a-f]{64}$/);
    assert.ok(JSON.stringify(log).length < 1000, 'log entry stays small');
  });

  test('a missing signature or one made with the wrong secret is rejected', async () => {
    const e = event('bp_x', 'PAID', 1);
    assert.equal((await request(app).post('/webhooks/billport').set('Content-Type', 'application/json').send(JSON.stringify(e))).status, 401);
    assert.equal((await signedWebhook(e, { secret: 'wrong-secret' })).status, 401);
  });

  test('a tampered body fails even with a once-valid signature', async () => {
    const raw = JSON.stringify(event('bp_x', 'PAID', 3));
    const sig = crypto.createHmac('sha256', process.env.BILLPORT_SECRET).update(raw).digest('hex');
    const tampered = raw.replace('"sequence":3', '"sequence":13');
    const res = await request(app).post('/webhooks/billport').set('Content-Type', 'application/json').set('X-Signature', sig).send(tampered);
    assert.equal(res.status, 401);
  });

  test('a signed but malformed event is a 400 and its body is not stored', async () => {
    const res = await signedWebhook({ eventId: 'e1', status: 'NOT_A_STATUS' });
    assert.equal(res.status, 400);
    const log = await IntegrationLog.findOne({ outcome: 'rejected_malformed' }).lean();
    assert.equal(log.request.raw, undefined);
    assert.equal(typeof log.request.sha256, 'string');
  });
});

describe('dedup and ordering', () => {
  test('a valid event moves the invoice forward', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    const [res] = await deliver(event(invoice.externalId, 'SENT', 1));
    assert.equal(res.status, 200);
    assert.equal(await statusOf(invoice._id), 'sent');
  });

  test('the same eventId three times is applied once', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    const e = event(invoice.externalId, 'SENT', 1);
    const responses = await deliver(e, e, e);
    assert.deepEqual(responses.map((r) => r.status), [200, 200, 200]);
    assert.equal(await WebhookEvent.countDocuments({ eventId: e.eventId }), 1);
    assert.equal(await IntegrationLog.countDocuments({ eventId: e.eventId, outcome: 'duplicate_ignored' }), 2);
  });

  test('out of order: PAID (seq 3) then VIEWED (seq 2) stays paid', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    await deliver(event(invoice.externalId, 'PAID', 3), event(invoice.externalId, 'VIEWED', 2));
    assert.equal(await statusOf(invoice._id), 'paid');
    assert.equal((await WebhookEvent.findOne({ sequence: 2 }).lean()).state, 'ignored');
  });

  test('forward-only: a higher sequence cannot move the status backwards', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    await deliver(event(invoice.externalId, 'VIEWED', 2), event(invoice.externalId, 'SENT', 5));
    assert.equal(await statusOf(invoice._id), 'viewed');
  });

  test('PAID reduces the outstanding balance exactly once, even when duplicated', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    const before = (await Customer.findById(invoice.customerId).lean()).outstandingBalance;
    await deliver(event(invoice.externalId, 'PAID', 3), event(invoice.externalId, 'PAID', 4));
    const after = (await Customer.findById(invoice.customerId).lean()).outstandingBalance;
    assert.equal(before - after, invoice.amount);
  });

  test('a cancelled invoice ignores later BillPort events', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    await as('finance').post(`/api/invoices/${invoice._id}/cancel`);
    await deliver(event(invoice.externalId, 'PAID', 3));
    assert.equal(await statusOf(invoice._id), 'cancelled');
  });

  test('an event for an invoice we do not know yet is kept and applied later by the sweep', async () => {
    const { as } = await loginAll();
    const externalId = `bp_${crypto.randomUUID()}`;
    await deliver(event(externalId, 'SENT', 1)); // arrives before our push response stored the id
    const stored = await WebhookEvent.findOne({ externalId }).lean();
    assert.equal(stored.state, 'received');
    assert.equal(stored.attempts, 1);

    const invoice = await pushedInvoice(as, externalId);
    await WebhookEvent.updateOne({ _id: stored._id }, { updatedAt: new Date(Date.now() - 10_000) }, { timestamps: false });
    await sweepPendingEvents();
    assert.equal(await statusOf(invoice._id), 'sent');
  });
});

describe('reconciliation', () => {
  test('a stale invoice is repaired from BillPort using the same forward-only rule', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    await Invoice.updateOne({ _id: invoice._id }, { statusUpdatedAt: new Date(Date.now() - 5 * 60_000) });
    mock.method(billport, 'getInvoice', async () => ({ ok: true, status: 200, body: { status: 'VIEWED' } }));

    await runReconciliation();
    assert.equal(await statusOf(invoice._id), 'viewed');
    const log = await IntegrationLog.findOne({ invoiceId: invoice._id, action: 'reconcile' }).lean();
    assert.equal(log.outcome, 'repaired pending -> viewed');
  });

  test('a BillPort lookup failure changes nothing and is logged', async () => {
    const { as } = await loginAll();
    const invoice = await pushedInvoice(as);
    await Invoice.updateOne({ _id: invoice._id }, { statusUpdatedAt: new Date(Date.now() - 5 * 60_000) });
    mock.method(billport, 'getInvoice', async () => ({ ok: false, status: 503 }));

    await runReconciliation();
    assert.equal(await statusOf(invoice._id), 'pending');
    assert.ok(await IntegrationLog.exists({ invoiceId: invoice._id, action: 'reconcile', outcome: 'lookup_failed' }));
  });
});
