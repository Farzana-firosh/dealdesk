const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const ApprovalConfig = require('../src/modules/approvals/approval-config.model');
const { app, useDatabase, loginAll } = require('./helpers');

useDatabase();

const grant = (key, scope) => ({ key, scope });
const byName = (roles, name) => roles.find((r) => r.name === name);

async function listRoles(as, who = 'admin') {
  return (await as(who).get('/api/roles')).body.roles;
}

// Signs in a new user holding a role made of `permissions`; returns a request helper for them.
async function userWithRole(as, roleName, permissions) {
  const role = (await as('admin').post('/api/roles', { name: roleName, permissions })).body.role;
  const options = (await as('admin').get('/api/users/options')).body;
  const email = `${roleName}@example.com`;
  await as('admin').post('/api/users', {
    name: roleName, email, password: 'Str0ng-pass', roleId: role._id, branchId: options.branches[0]._id,
  });
  const { token } = (await request(app).post('/api/auth/login').send({ email, password: 'Str0ng-pass' })).body;
  const send = (method) => (url, body) => request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body);
  return { role, get: send('get'), post: send('post'), patch: send('patch'), delete: send('delete') };
}

describe('role list', () => {
  test('shows built-in flags, user counts and what the caller may edit', async () => {
    const { as } = await loginAll();
    const roles = await listRoles(as);
    assert.deepEqual(
      Object.fromEntries(roles.map((r) => [r.name, [r.builtIn, r.userCount, r.editable]])),
      {
        admin: [true, 1, false], // locked
        finance: [true, 1, true],
        sales_exec: [true, 2, true],
        sales_manager: [true, 2, true],
      },
    );
  });
});

describe('role rules', () => {
  test('the admin role always keeps every permission', async () => {
    const { as } = await loginAll();
    const admin = byName(await listRoles(as), 'admin');
    const res = await as('admin').patch(`/api/roles/${admin._id}`, { permissions: [] });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /always has every permission/);
  });

  test('a role manager cannot hand out or edit access they do not hold, nor edit their own role', async () => {
    const { as } = await loginAll();
    const lead = await userWithRole(as, 'role_lead', [grant('role.manage', 'all'), grant('deal.view', 'branch')]);

    const own = await lead.patch(`/api/roles/${lead.role._id}`, { description: 'mine' });
    assert.equal(own.status, 403);
    assert.match(own.body.error, /your own role/);

    const exec = byName(await listRoles(as), 'sales_exec');
    assert.equal((await lead.patch(`/api/roles/${exec._id}`, { description: 'x' })).status, 403);

    const escalate = await lead.post('/api/roles', { name: 'too_much', permissions: [grant('deal.view', 'all')] });
    assert.equal(escalate.status, 403);
    assert.deepEqual(escalate.body.details.missing, ['deal.view']);

    const mini = await lead.post('/api/roles', { name: 'viewer', permissions: [grant('deal.view', 'own')] });
    assert.equal(mini.status, 201);
    assert.equal((await lead.patch(`/api/roles/${mini.body.role._id}`, { permissions: [grant('deal.view', 'branch')] })).status, 200);
    assert.equal((await lead.patch(`/api/roles/${mini.body.role._id}`, { permissions: [grant('invoice.view', 'own')] })).status, 403);

    const seen = (await lead.get('/api/roles')).body.roles;
    assert.equal(byName(seen, 'viewer').editable, true);
    assert.equal(byName(seen, 'role_lead').editable, false);
  });

  test('names are simple and unique, and each permission appears once', async () => {
    const { as } = await loginAll();
    assert.equal((await as('admin').post('/api/roles', { name: 'Bad Name' })).status, 400);
    assert.equal((await as('admin').post('/api/roles', { name: 'Finance' })).status, 409);
    const twice = await as('admin').post('/api/roles', { name: 'dupe', permissions: [grant('deal.view', 'own'), grant('deal.view', 'all')] });
    assert.equal(twice.status, 400);
  });
});

describe('deleting roles', () => {
  test('only unused custom roles can be deleted', async () => {
    const { as } = await loginAll();
    const finance = byName(await listRoles(as), 'finance');
    assert.equal((await as('admin').delete(`/api/roles/${finance._id}`)).status, 403);

    const inUse = await userWithRole(as, 'in_use', [grant('deal.view', 'own')]);
    const busy = await as('admin').delete(`/api/roles/${inUse.role._id}`);
    assert.equal(busy.status, 409);
    assert.match(busy.body.error, /1 user has this role/);

    const inRules = (await as('admin').post('/api/roles', { name: 'approver' })).body.role;
    await ApprovalConfig.updateOne({ key: 'discount' }, { $push: { 'bands.0.steps': inRules._id } });
    assert.equal((await as('admin').delete(`/api/roles/${inRules._id}`)).status, 409);

    const unused = (await as('admin').post('/api/roles', { name: 'temporary' })).body.role;
    assert.equal((await as('admin').delete(`/api/roles/${unused._id}`)).status, 204);
    assert.equal(byName(await listRoles(as), 'temporary'), undefined);
  });
});
