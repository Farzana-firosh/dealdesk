const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const Deal = require('../src/modules/deals/deal.model');
const { runMigrations } = require('../src/database/migrate');
const { useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();

const lose = (as, who, deal, body) => as(who).post(`/api/deals/${deal._id}/lost`, body);
const discount = (as, who, deal, discountPercent) =>
  as(who).post(`/api/deals/${deal._id}/discount-request`, { discountPercent, remarks: 'x' });

describe('marking a deal lost', () => {
  test('needs a known reason, records when, and is final', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');

    assert.equal((await lose(as, 'execA', deal, {})).status, 400);
    assert.equal((await lose(as, 'execA', deal, { reason: 'bad_luck' })).status, 400);

    const res = await lose(as, 'execA', deal, { reason: 'competitor', notes: 'went with a cheaper rental' });
    assert.equal(res.status, 200);
    assert.equal(res.body.deal.status, 'lost');
    assert.equal(res.body.deal.lostReason, 'competitor');
    assert.equal(res.body.deal.lostNotes, 'went with a cheaper rental');
    assert.ok(res.body.deal.closedAt);

    // nothing can start from a lost deal
    assert.equal((await lose(as, 'execA', deal, { reason: 'price' })).status, 409);
    assert.equal((await discount(as, 'execA', deal, 5)).status, 409);
    assert.equal((await as('execA').patch(`/api/deals/${deal._id}`, { title: 'again' })).status, 409);
    assert.equal((await as('finance').post(`/api/deals/${deal._id}/convert`)).status, 409);
  });

  test('only open deals in your scope', async () => {
    const { as } = await loginAll();
    const pending = await createDeal(as, 'execA');
    await discount(as, 'execA', pending, 20); // waits for the manager
    assert.equal((await lose(as, 'execA', pending, { reason: 'timing' })).status, 409);

    const other = await createDeal(as, 'execB');
    assert.equal((await lose(as, 'execA', other, { reason: 'timing' })).status, 404);
  });
});

describe('deal analytics', () => {
  test('counts by status and win rate, limited to the caller scope', async () => {
    const { as } = await loginAll();
    const won = await createDeal(as, 'execA');
    await discount(as, 'execA', won, 5); // inside the auto-approval band
    const lost = await createDeal(as, 'execA');
    await lose(as, 'execA', lost, { reason: 'price' });
    await createDeal(as, 'execB');

    const mine = (await as('execA').get('/api/analytics/deals')).body;
    assert.equal(mine.scope, 'own');
    assert.equal(mine.byStatus.won.count, 1);
    assert.equal(mine.byStatus.lost.count, 1);
    assert.equal(mine.byStatus.lost.value, lost.total);
    assert.equal(mine.winRate, 50);
    assert.deepEqual(mine.lostReasons.map((r) => [r.reason, r.count]), [['price', 1]]);
    assert.equal(mine.months.length, 6);
    assert.deepEqual([mine.months[5].won.count, mine.months[5].lost.count], [1, 1]);

    // seeded: 1 deal for execA, 1 for managerA, 1 for execB; plus the 3 above
    const everyone = (await as('admin').get('/api/analytics/deals')).body;
    const total = Object.values(everyone.byStatus).reduce((s, x) => s + x.count, 0);
    assert.equal(total, 6);
    assert.equal((await as('execB').get('/api/analytics/deals')).body.winRate, null);
  });
});

describe('closedAt migration', () => {
  test('backfills won deals from wonAt', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const wonAt = new Date('2026-09-15T10:00:00Z');
    await Deal.collection.updateOne({ _id: Deal.castObject({ _id: deal._id })._id }, { $set: { status: 'won', wonAt } });

    await runMigrations();
    assert.deepEqual((await Deal.findById(deal._id).lean()).closedAt, wonAt);
  });
});
