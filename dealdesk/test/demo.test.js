// Demo mode is read once at start-up, so this file (its own process) switches it on first.
process.env.DEMO_MODE = 'true';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Role = require('../src/modules/roles/role.model');
const User = require('../src/modules/users/user.model');
const { BUILT_IN_ROLES } = require('../src/modules/roles/role.service');
const { app, useDatabase, loginAll } = require('./helpers');

useDatabase();

const demoLogin = (account) => request(app).post('/api/auth/demo').send({ account });

describe('demo sign-in', () => {
  test('lists the personas without emails or passwords', async () => {
    const res = await request(app).get('/api/auth/demo');
    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, true);
    assert.deepEqual(res.body.accounts.map((a) => a.key), ['exec', 'manager', 'finance', 'admin']);
    assert.doesNotMatch(JSON.stringify(res.body), /@|password/i);
  });

  test('each persona signs in as its seeded user, with that role', async () => {
    const expected = { exec: 'sales_exec', manager: 'sales_manager', finance: 'finance', admin: 'admin' };
    for (const [account, role] of Object.entries(expected)) {
      const res = await demoLogin(account);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.role.name, role);

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
      assert.equal(me.status, 200);
    }
  });

  test('unknown personas are rejected', async () => {
    assert.equal((await demoLogin('root')).status, 400);
    assert.equal((await request(app).post('/api/auth/demo').send({})).status, 400);
  });

  test('a deactivated demo account cannot be used', async () => {
    const { as } = await loginAll();
    await User.updateOne({ email: 'exec.a@dealdesk.test' }, { active: false });
    assert.equal((await demoLogin('exec')).status, 404);
    assert.equal((await as('admin').get('/api/auth/me')).status, 200);
  });
});

describe('demo protection', () => {
  test('every seeded role is a protected built-in role', async () => {
    const seeded = (await Role.find().lean()).map((r) => r.name).sort();
    assert.deepEqual(seeded, [...BUILT_IN_ROLES].sort());
  });

  test('built-in roles are read-only, so the demo cannot be broken', async () => {
    const { as } = await loginAll();
    const admin = await Role.findOne({ name: 'admin' }).lean();
    const res = await as('admin').patch(`/api/roles/${admin._id}`, { permissions: [] });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /read-only in the demo/);
    assert.equal((await Role.findById(admin._id).lean()).permissions.length, admin.permissions.length);
  });

  test('custom roles can still be created and edited', async () => {
    const { as } = await loginAll();
    const created = await as('admin').post('/api/roles', { name: 'auditor', permissions: [{ key: 'deal.view', scope: 'all' }] });
    assert.equal(created.status, 201);
    const edited = await as('admin').patch(`/api/roles/${created.body.role._id}`, { permissions: [{ key: 'invoice.view', scope: 'all' }] });
    assert.equal(edited.status, 200);
  });
});
