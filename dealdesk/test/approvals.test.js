const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const ApprovalHistory = require('../src/modules/approvals/approval-history.model');
const Deal = require('../src/modules/deals/deal.model');
const User = require('../src/modules/users/user.model');
const Role = require('../src/modules/roles/role.model');
const { hashPassword } = require('../src/modules/auth/auth.service');
const supertest = require('supertest');
const { app, useDatabase, loginAll, createDeal, EMAILS, PASSWORD } = require('./helpers');

useDatabase();

const requestDiscount = (as, who, deal, discountPercent, remarks = 'please') =>
  as(who).post(`/api/deals/${deal._id}/discount-request`, { discountPercent, remarks });

describe('approval chain resolution (seeded bands)', () => {
  test('<= 10% is auto-approved and the deal is won with the discount applied', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const res = await requestDiscount(as, 'execA', deal, 10);
    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, 'approved');
    assert.equal(res.body.request.steps.length, 0);

    const won = await Deal.findById(deal._id).lean();
    assert.equal(won.status, 'won');
    assert.equal(won.total, Math.round(won.subtotal * 90) / 100);
  });

  test('the chain is snapshotted from the band: 30% needs manager then finance', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { body } = await requestDiscount(as, 'execA', deal, 30);
    assert.deepEqual(body.request.steps.map((s) => s.roleName), ['sales_manager', 'finance']);
    assert.equal(body.request.currentStep, 1);
    assert.equal((await Deal.findById(deal._id).lean()).status, 'pending_approval');
  });

  test('config changes apply to new requests immediately, without touching open ones', async () => {
    const { as } = await loginAll();
    const first = await createDeal(as, 'execA');
    const before = (await requestDiscount(as, 'execA', first, 15)).body.request;

    const put = await as('admin').put('/api/approval-config', {
      bands: [
        { minPercent: 0, maxPercent: 50, steps: ['finance'] },
        { minPercent: 50, maxPercent: 100, steps: ['admin'] },
      ],
    });
    assert.equal(put.status, 200);

    const second = await createDeal(as, 'execA');
    const after = (await requestDiscount(as, 'execA', second, 15)).body.request;
    assert.deepEqual(before.steps.map((s) => s.roleName), ['sales_manager']);
    assert.deepEqual(after.steps.map((s) => s.roleName), ['finance']);
  });

  test('bands with a gap are rejected', async () => {
    const { as } = await loginAll();
    const res = await as('admin').put('/api/approval-config', {
      bands: [
        { minPercent: 0, maxPercent: 10, steps: [] },
        { minPercent: 20, maxPercent: 100, steps: ['admin'] },
      ],
    });
    assert.equal(res.status, 400);
  });

  test('only open deals accept a discount request; a second request is a 409', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    assert.equal((await requestDiscount(as, 'execA', deal, 20)).status, 201);
    assert.equal((await requestDiscount(as, 'execA', deal, 20)).status, 409);
  });
});

describe('who may decide', () => {
  test('a full two-step chain: manager, then finance, then the deal is won', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 30)).body;

    const step1 = await as('managerA').post(`/api/approvals/${request._id}/approve`, { remarks: 'ok' });
    assert.equal(step1.status, 200);
    assert.equal(step1.body.request.currentStep, 2);

    const step2 = await as('finance').post(`/api/approvals/${request._id}/approve`, {});
    assert.equal(step2.status, 200);
    assert.equal(step2.body.request.status, 'approved');

    const won = await Deal.findById(deal._id).lean();
    assert.equal(won.status, 'won');
    assert.equal(won.discountPercent, 30);

    const history = await ApprovalHistory.find({ requestId: request._id }).sort({ timestamp: 1 }).lean();
    assert.deepEqual(history.map((h) => h.action), ['requested', 'approved', 'approved']);
  });

  test('a later-step approver cannot jump the queue (409)', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 30)).body;
    assert.equal((await as('finance').post(`/api/approvals/${request._id}/approve`, {})).status, 409);
  });

  test('a role that is not in the chain gets a 403', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 15)).body;
    assert.equal((await as('finance').post(`/api/approvals/${request._id}/approve`, {})).status, 403);
    assert.equal((await as('execB').post(`/api/approvals/${request._id}/approve`, {})).status, 403); // no discount.approve
  });

  test("another branch's manager cannot see or decide the request (404)", async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 15)).body;
    assert.equal((await as('managerB').post(`/api/approvals/${request._id}/approve`, {})).status, 404);
    assert.equal((await as('managerB').get('/api/approvals/pending')).body.count, 0);
    assert.equal((await as('managerA').get('/api/approvals/pending')).body.count, 1);
  });

  test('nobody approves their own request', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'managerA'); // the manager is also the requester
    const { request } = (await requestDiscount(as, 'managerA', deal, 15)).body;
    assert.equal((await as('managerA').post(`/api/approvals/${request._id}/approve`, {})).status, 403);
  });

  test('a rejection needs remarks, ends the chain and reopens the deal', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 30)).body;

    assert.equal((await as('managerA').post(`/api/approvals/${request._id}/reject`, {})).status, 400);
    const res = await as('managerA').post(`/api/approvals/${request._id}/reject`, { remarks: 'too much' });
    assert.equal(res.status, 200);
    assert.equal(res.body.request.status, 'rejected');
    assert.equal((await Deal.findById(deal._id).lean()).status, 'open');

    // decided requests cannot be decided again
    assert.equal((await as('managerA').post(`/api/approvals/${request._id}/approve`, {})).status, 409);
  });
});

describe('concurrency', () => {
  test('two managers approving the same step at once: exactly one wins', async () => {
    const { as } = await loginAll();
    // a second Dubai manager, so two different users hold the step-1 role in the same branch
    const managerA = await User.findOne({ email: EMAILS.managerA }).lean();
    await User.create({
      name: 'Second Manager',
      email: 'manager.a2@dealdesk.test',
      passwordHash: await hashPassword(PASSWORD),
      roleId: (await Role.findOne({ name: 'sales_manager' }).lean())._id,
      branchId: managerA.branchId,
    });
    const token2 = (await supertest(app).post('/api/auth/login').send({ email: 'manager.a2@dealdesk.test', password: PASSWORD })).body.token;

    const deal = await createDeal(as, 'execA');
    const { request } = (await requestDiscount(as, 'execA', deal, 30)).body;

    const [a, b] = await Promise.all([
      as('managerA').post(`/api/approvals/${request._id}/approve`, {}),
      supertest(app).post(`/api/approvals/${request._id}/approve`).set('Authorization', `Bearer ${token2}`).send({}),
    ]);

    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const approvals = await ApprovalHistory.countDocuments({ requestId: request._id, action: 'approved' });
    assert.equal(approvals, 1, 'only one approval recorded for step 1');
  });

  test('parallel discount requests on one deal start only one chain', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const results = await Promise.all([20, 20, 20].map((pct) => requestDiscount(as, 'execA', deal, pct)));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  });

  test('approval history is append-only', async () => {
    await assert.rejects(ApprovalHistory.updateMany({}, { remarks: 'tampered' }), /append-only/);
    await assert.rejects(ApprovalHistory.deleteMany({}), /append-only/);
  });
});
