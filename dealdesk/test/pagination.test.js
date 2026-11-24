const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const Invoice = require('../src/modules/invoices/invoice.model');
const { pageParams } = require('../src/common/utils/paginate');
const { useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();

describe('pagination', () => {
  test('page parameters fall back to defaults and the limit is capped', () => {
    assert.deepEqual(pageParams({}), { page: 1, limit: 20 });
    assert.deepEqual(pageParams({ page: '3', limit: '5' }), { page: 3, limit: 5 });
    assert.deepEqual(pageParams({ page: '0', limit: '-4' }), { page: 1, limit: 1 });
    assert.deepEqual(pageParams({ page: 'abc', limit: 'x' }), { page: 1, limit: 20 });
    assert.deepEqual(pageParams({ limit: '5000' }), { page: 1, limit: 100 });
  });

  test('deals come in non-overlapping pages, newest first, with totals', async () => {
    const { as } = await loginAll();
    for (let i = 0; i < 4; i++) await createDeal(as, 'execA'); // + 1 seeded deal = 5 owned by execA

    const first = (await as('execA').get('/api/deals?limit=2')).body;
    const third = (await as('execA').get('/api/deals?limit=2&page=3')).body;
    const beyond = (await as('execA').get('/api/deals?limit=2&page=9')).body;

    assert.deepEqual({ page: first.page, limit: first.limit, total: first.total, pages: first.pages, count: first.count },
      { page: 1, limit: 2, total: 5, pages: 3, count: 2 });
    assert.equal(third.deals.length, 1);
    assert.equal(beyond.deals.length, 0);
    assert.equal(first.scope, 'own');

    const all = (await as('execA').get('/api/deals?limit=100')).body.deals;
    const dates = all.map((d) => new Date(d.createdAt).getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => b - a));

    const pages = await Promise.all([1, 2, 3].map((p) => as('execA').get(`/api/deals?limit=2&page=${p}`)));
    const ids = pages.flatMap((r) => r.body.deals.map((d) => d._id));
    assert.equal(new Set(ids).size, 5);
  });

  test('the total follows scope and status filter', async () => {
    const { as } = await loginAll();
    const managerA = (await as('managerA').get('/api/deals?limit=1')).body;
    const finance = (await as('finance').get('/api/deals?limit=1')).body;
    assert.equal(managerA.total, 2); // both seeded Branch A deals
    assert.equal(finance.total, 3);
    assert.equal((await as('finance').get('/api/deals?status=won')).body.total, 0);
  });

  test('invoices page and carry a summary over everything in scope', async () => {
    const { as } = await loginAll();
    for (let i = 0; i < 3; i++) {
      const deal = await createDeal(as, 'execA');
      await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 5 });
      await as('finance').post(`/api/deals/${deal._id}/convert`);
    }
    const [paid, failed] = await Invoice.find().sort({ createdAt: 1 }).lean();
    await Invoice.updateOne({ _id: paid._id }, { status: 'paid' });
    await Invoice.updateOne({ _id: failed._id }, { pushStatus: 'failed' });

    const res = (await as('finance').get('/api/invoices?limit=1')).body;
    assert.equal(res.invoices.length, 1);
    assert.equal(res.total, 3);
    assert.equal(res.pages, 3);
    assert.equal(res.summary.total, 3);
    assert.equal(res.summary.paid, 1);
    assert.equal(res.summary.outstanding.count, 2);
    assert.equal(res.summary.failedPush, 1);

    // the status filter narrows the page, not the summary
    const onlyPaid = (await as('finance').get('/api/invoices?status=paid')).body;
    assert.equal(onlyPaid.total, 1);
    assert.equal(onlyPaid.summary.total, 3);

    // an exec in the other branch sees none of them
    const execB = (await as('execB').get('/api/invoices')).body;
    assert.equal(execB.total, 0);
    assert.equal(execB.summary.outstanding.amount, 0);
  });
});
