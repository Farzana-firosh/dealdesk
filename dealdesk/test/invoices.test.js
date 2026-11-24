const { describe, test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Invoice = require('../src/modules/invoices/invoice.model');
const Sale = require('../src/modules/invoices/sale.model');
const Customer = require('../src/modules/customers/customer.model');
const IntegrationLog = require('../src/modules/invoices/integration-log.model');
const billport = require('../src/modules/invoices/billport.client');
const { runPushCycle, claimNext, pushOne } = require('../src/modules/invoices/invoice-push.job');
const env = require('../src/config/env');
const { useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();
afterEach(() => mock.restoreAll());

// BillPort responses in the shape billport.client returns them
const ok = (externalId = `bp_${Math.random().toString(36).slice(2)}`) => ({ ok: true, status: 201, body: { externalId, status: 'QUEUED' }, durationMs: 5 });
const http = (status) => ({ ok: false, status, body: { error: 'x' }, durationMs: 5 });
const timeout = () => ({ ok: false, status: null, error: 'timeout after 4000ms', durationMs: 4000 });

/** Stubs BillPort with a list of responses, one per call; records the idempotency keys sent. */
function stubBillport(...responses) {
  const keys = [];
  mock.method(billport, 'createInvoice', async (payload, key) => {
    keys.push(key);
    return responses.length > 1 ? responses.shift() : responses[0];
  });
  return keys;
}

// A won deal (5% is auto-approved), converted by finance.
async function convertedInvoice(as) {
  const deal = await createDeal(as, 'execA');
  await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 5 });
  const res = await as('finance').post(`/api/deals/${deal._id}/convert`);
  assert.equal(res.status, 201);
  return { deal, invoice: res.body.invoice };
}

const makeDue = (id) => Invoice.updateOne({ _id: id }, { nextPushAt: new Date(Date.now() - 1) });

describe('convert: exactly one sale and invoice per deal', () => {
  test('only won deals convert, and only with invoice.issue', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    assert.equal((await as('finance').post(`/api/deals/${deal._id}/convert`)).status, 409); // still open
    assert.equal((await as('execA').post(`/api/deals/${deal._id}/convert`)).status, 403);
  });

  test('converting twice is a 409 and creates nothing new', async () => {
    const { as } = await loginAll();
    const { deal } = await convertedInvoice(as);
    assert.equal((await as('finance').post(`/api/deals/${deal._id}/convert`)).status, 409);
    assert.equal(await Sale.countDocuments({ dealId: deal._id }), 1);
    assert.equal(await Invoice.countDocuments({ dealId: deal._id }), 1);
  });

  test('parallel converts of the same deal produce exactly one invoice and one balance increase', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 5 });
    const balanceBefore = (await Customer.findById(deal.customerId).lean()).outstandingBalance;

    const results = await Promise.all([1, 2, 3, 4].map(() => as('finance').post(`/api/deals/${deal._id}/convert`)));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.ok(results.every((r) => r.status === 201 || r.status === 409));
    assert.equal(await Invoice.countDocuments({ dealId: deal._id }), 1);

    const invoice = await Invoice.findOne({ dealId: deal._id }).lean();
    const balanceAfter = (await Customer.findById(deal.customerId).lean()).outstandingBalance;
    assert.equal(balanceAfter - balanceBefore, invoice.amount);
  });

  test('converting never calls BillPort inline: the invoice is queued', async () => {
    const { as } = await loginAll();
    const keys = stubBillport(ok());
    const { invoice } = await convertedInvoice(as);
    assert.equal(invoice.pushStatus, 'queued');
    assert.equal(keys.length, 0);
  });
});

describe('push worker', () => {
  test('a 503 schedules a retry with backoff; the retry reuses the same idempotency key', async () => {
    const { as } = await loginAll();
    const { invoice } = await convertedInvoice(as);
    const keys = stubBillport(http(503), ok('bp_once'));

    await runPushCycle();
    let doc = await Invoice.findById(invoice._id).lean();
    assert.equal(doc.pushStatus, 'retrying');
    assert.equal(doc.pushAttempts, 1);
    assert.ok(doc.nextPushAt > new Date(), 'next attempt is in the future');
    assert.equal(doc.pushLockedUntil, null);

    await makeDue(invoice._id);
    await runPushCycle();
    doc = await Invoice.findById(invoice._id).lean();
    assert.equal(doc.pushStatus, 'succeeded');
    assert.equal(doc.externalId, 'bp_once');
    assert.deepEqual(keys, [invoice.idempotencyKey, invoice.idempotencyKey]);

    const outcomes = (await IntegrationLog.find({ invoiceId: invoice._id, action: 'push' }).sort({ createdAt: 1 }).lean()).map((l) => l.outcome);
    assert.match(outcomes[0], /^retry_scheduled_in_/);
    assert.equal(outcomes[1], 'success');
  });

  test('a timeout is retried (BillPort may have created it; the key makes the retry safe)', async () => {
    const { as } = await loginAll();
    const { invoice } = await convertedInvoice(as);
    stubBillport(timeout());
    await runPushCycle();
    assert.equal((await Invoice.findById(invoice._id).lean()).pushStatus, 'retrying');
  });

  test('a 4xx is terminal; manual retry re-queues with the same key, only from failed', async () => {
    const { as } = await loginAll();
    const { invoice } = await convertedInvoice(as);
    stubBillport(http(400));
    await runPushCycle();
    assert.equal((await Invoice.findById(invoice._id).lean()).pushStatus, 'failed');

    const retry = await as('finance').post(`/api/invoices/${invoice._id}/retry-push`);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.invoice.pushStatus, 'queued');
    assert.equal(retry.body.invoice.pushAttempts, 0);
    assert.equal(retry.body.invoice.idempotencyKey, invoice.idempotencyKey);

    assert.equal((await as('finance').post(`/api/invoices/${invoice._id}/retry-push`)).status, 409); // no longer failed
    assert.equal((await as('execA').post(`/api/invoices/${invoice._id}/retry-push`)).status, 403);
  });

  test('gives up after the maximum number of attempts', async () => {
    const { as } = await loginAll();
    const { invoice } = await convertedInvoice(as);
    stubBillport(http(503));
    for (let i = 0; i < env.push.maxAttempts; i++) {
      await makeDue(invoice._id);
      await runPushCycle();
    }
    const doc = await Invoice.findById(invoice._id).lean();
    assert.equal(doc.pushStatus, 'failed');
    assert.equal(doc.pushAttempts, env.push.maxAttempts);
  });

  test('two workers can never claim the same invoice', async () => {
    const { as } = await loginAll();
    await convertedInvoice(as);
    const claims = await Promise.all([claimNext(), claimNext(), claimNext()]);
    assert.equal(claims.filter(Boolean).length, 1);
  });
});

describe('cancel vs. in-flight push (regression)', () => {
  // The worker has claimed the invoice and is waiting on BillPort when someone cancels it.
  async function cancelDuringPush(as, response) {
    const { invoice } = await convertedInvoice(as);
    const claimed = await claimNext();
    assert.equal(String(claimed._id), String(invoice._id));

    const cancel = await as('finance').post(`/api/invoices/${invoice._id}/cancel`);
    assert.equal(cancel.status, 200);

    stubBillport(response);
    await pushOne(claimed);
    return Invoice.findById(invoice._id).lean();
  }

  test('a retryable failure does not revive a cancelled invoice', async () => {
    const { as } = await loginAll();
    const doc = await cancelDuringPush(as, http(503));
    assert.equal(doc.status, 'cancelled');
    assert.equal(doc.pushStatus, 'cancelled');
    assert.equal(doc.pushLockedUntil, null);

    // the worker must not pick it up again
    await makeDue(doc._id);
    assert.equal(await claimNext(), null);

    const log = await IntegrationLog.findOne({ invoiceId: doc._id, action: 'push' }).lean();
    assert.match(log.outcome, /^cancelled_during_push/);
  });

  test('a success after cancel keeps the invoice cancelled but records the BillPort id', async () => {
    const { as } = await loginAll();
    const doc = await cancelDuringPush(as, ok('bp_late'));
    assert.equal(doc.status, 'cancelled');
    assert.equal(doc.pushStatus, 'cancelled');
    assert.equal(doc.externalId, 'bp_late');
  });
});

describe('cancel', () => {
  test('cancelling restores the outstanding balance once; a second cancel is a 409', async () => {
    const { as } = await loginAll();
    const { deal, invoice } = await convertedInvoice(as);
    const before = (await Customer.findById(deal.customerId).lean()).outstandingBalance;

    assert.equal((await as('execA').post(`/api/invoices/${invoice._id}/cancel`)).status, 403);
    assert.equal((await as('finance').post(`/api/invoices/${invoice._id}/cancel`)).status, 200);
    assert.equal((await as('finance').post(`/api/invoices/${invoice._id}/cancel`)).status, 409);

    const after = (await Customer.findById(deal.customerId).lean()).outstandingBalance;
    assert.equal(before - after, invoice.amount);
  });

  test('invoice lists respect scope', async () => {
    const { as } = await loginAll();
    await convertedInvoice(as); // owned by exec A (Dubai)
    assert.equal((await as('execA').get('/api/invoices')).body.count, 1);
    assert.equal((await as('managerA').get('/api/invoices')).body.count, 1);
    assert.equal((await as('execB').get('/api/invoices')).body.count, 0);
    assert.equal((await as('managerB').get('/api/invoices')).body.count, 0);
  });
});
