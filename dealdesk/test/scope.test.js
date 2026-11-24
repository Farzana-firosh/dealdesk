const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../src/modules/customers/customer.model');
const Branch = require('../src/modules/branches/branch.model');
const Role = require('../src/modules/roles/role.model');
const { useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();

const branchIdOf = async (code) => String((await Branch.findOne({ code }).lean())._id);

describe('deal scope (own / branch / all)', () => {
  test('three users with deal.view see three different lists', async () => {
    const { as } = await loginAll();
    const counts = {};
    for (const who of ['execA', 'managerA', 'finance']) {
      const res = await as(who).get('/api/deals');
      assert.equal(res.status, 200);
      counts[who] = res.body.count;
    }
    assert.deepEqual(counts, { execA: 1, managerA: 2, finance: 3 });
  });

  test('an out-of-scope deal is a 404, not a 403', async () => {
    const { as } = await loginAll();
    const branchBDeal = (await as('execB').get('/api/deals')).body.deals[0];

    assert.equal((await as('execA').get(`/api/deals/${branchBDeal._id}`)).status, 404);
    assert.equal((await as('managerA').get(`/api/deals/${branchBDeal._id}`)).status, 404);
    assert.equal((await as('finance').get(`/api/deals/${branchBDeal._id}`)).status, 200);
  });

  test('a malformed id is a 404 too', async () => {
    const { as } = await loginAll();
    assert.equal((await as('finance').get('/api/deals/not-an-id')).status, 404);
  });

  test('users cannot edit deals outside their scope', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    assert.equal((await as('execB').patch(`/api/deals/${deal._id}`, { title: 'hijack' })).status, 404);
    assert.equal((await as('execA').patch(`/api/deals/${deal._id}`, { title: 'renamed' })).status, 200);
  });
});

describe('customer and product isolation (regression)', () => {
  test('branch users only see their own branch customers', async () => {
    const { as } = await loginAll();
    const [dxb, auh] = await Promise.all([branchIdOf('DXB'), branchIdOf('AUH')]);

    for (const [who, branch] of [['execA', dxb], ['managerA', dxb], ['execB', auh], ['managerB', auh]]) {
      const { body } = await as(who).get('/api/customers');
      assert.ok(body.customers.length > 0, `${who} sees some customers`);
      assert.ok(body.customers.every((c) => String(c.branchId) === branch), `${who} sees only branch ${branch}`);
    }
  });

  test('deal.view scope "all" sees every branch customer', async () => {
    const { as } = await loginAll();
    const total = await Customer.countDocuments();
    assert.equal((await as('finance').get('/api/customers')).body.customers.length, total);
    assert.equal((await as('admin').get('/api/customers')).body.customers.length, total);
  });

  test('a deal cannot be created or moved to another branch customer', async () => {
    const { as } = await loginAll();
    const auhCustomer = await Customer.findOne({ branchId: await branchIdOf('AUH') }).lean();
    const productId = (await as('execA').get('/api/products')).body.products[0]._id;

    const create = await as('execA').post('/api/deals', {
      title: 'Cross-branch',
      customerId: String(auhCustomer._id),
      items: [{ productId, quantity: 1 }],
    });
    assert.equal(create.status, 400);
    assert.equal(create.body.error, 'Unknown customer');

    const deal = await createDeal(as, 'execA');
    const move = await as('execA').patch(`/api/deals/${deal._id}`, { customerId: String(auhCustomer._id) });
    assert.equal(move.status, 400);
  });

  test('reference data requires a deal permission', async () => {
    const { as } = await loginAll();
    // strip every deal permission from sales_exec
    await Role.updateOne({ name: 'sales_exec' }, { $pull: { permissions: { key: { $in: ['deal.view', 'deal.edit'] } } } });
    assert.equal((await as('execA').get('/api/customers')).status, 403);
    assert.equal((await as('execA').get('/api/products')).status, 403);
  });
});
