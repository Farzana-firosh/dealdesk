const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Role = require('../src/modules/roles/role.model');
const { runMigrations } = require('../src/database/migrate');
const { app, useDatabase, loginAll } = require('./helpers');

useDatabase();

const NEW_PASSWORD = 'Str0ng-pass';

const signIn = (email, password = NEW_PASSWORD) => request(app).post('/api/auth/login').send({ email, password });

// Ids by name, from the form options the admin sees.
async function lookups(as) {
  const { body } = await as('admin').get('/api/users/options');
  const users = (await as('admin').get('/api/users')).body.users;
  return {
    role: Object.fromEntries(body.roles.map((r) => [r.name, r._id])),
    branch: Object.fromEntries(body.branches.map((b) => [b.code, b._id])),
    user: Object.fromEntries(users.map((u) => [u.email, u._id])),
  };
}

async function createUser(as, who, fields) {
  return as(who).post('/api/users', { name: 'New Person', password: NEW_PASSWORD, ...fields });
}

describe('users api access', () => {
  test('only user.manage holders can reach it', async () => {
    const { as } = await loginAll();
    for (const who of ['execA', 'managerA', 'finance']) {
      assert.equal((await as(who).get('/api/users')).status, 403);
    }
    const res = await as('admin').get('/api/users');
    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 6);
    assert.doesNotMatch(JSON.stringify(res.body), /passwordHash/);
  });
});

describe('creating users', () => {
  test('a new user can sign in with their role and branch', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const res = await createUser(as, 'admin', {
      email: 'New.Exec@Example.com',
      roleId: ids.role.sales_exec,
      branchId: ids.branch.DXB,
      managerId: ids.user['manager.a@dealdesk.test'],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'new.exec@example.com');
    assert.equal(res.body.user.manager.name, 'Omar Manager');
    assert.doesNotMatch(JSON.stringify(res.body), /passwordHash|Str0ng/);

    const login = await signIn('new.exec@example.com');
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role.name, 'sales_exec');
  });

  test('rejects duplicate emails, weak passwords and managers from another branch', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const base = { roleId: ids.role.sales_exec, branchId: ids.branch.DXB };

    assert.equal((await createUser(as, 'admin', { ...base, email: 'EXEC.A@dealdesk.test' })).status, 409);
    assert.equal((await createUser(as, 'admin', { ...base, email: 'x@example.com', password: 'short' })).status, 400);
    const wrongManager = await createUser(as, 'admin', { ...base, email: 'x@example.com', managerId: ids.user['manager.b@dealdesk.test'] });
    assert.equal(wrongManager.status, 400);
    assert.match(wrongManager.body.error, /same branch/);
  });
});

describe('deactivating users', () => {
  test('a deactivated user is signed out at once and cannot sign in', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const created = await createUser(as, 'admin', { email: 'leaver@example.com', roleId: ids.role.sales_exec, branchId: ids.branch.DXB });
    const { token } = (await signIn('leaver@example.com')).body;

    const res = await as('admin').patch(`/api/users/${created.body.user._id}`, { active: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.active, false);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
    assert.equal((await signIn('leaver@example.com')).status, 401);
  });

  test('a password reset by an admin replaces the old password', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const created = await createUser(as, 'admin', { email: 'reset@example.com', roleId: ids.role.sales_exec, branchId: ids.branch.DXB });
    await as('admin').patch(`/api/users/${created.body.user._id}`, { password: 'An0ther-pass' });
    assert.equal((await signIn('reset@example.com')).status, 401);
    assert.equal((await signIn('reset@example.com', 'An0ther-pass')).status, 200);
  });
});

describe('access rules', () => {
  test('nobody can change their own access, status or password', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const me = ids.user['admin@dealdesk.test'];
    for (const change of [{ active: false }, { roleId: ids.role.sales_exec }, { branchId: ids.branch.AUH }, { password: 'Whatever-123' }]) {
      const res = await as('admin').patch(`/api/users/${me}`, change);
      assert.equal(res.status, 403, JSON.stringify(change));
    }
    assert.equal((await as('admin').patch(`/api/users/${me}`, { name: 'Adam A.' })).status, 200);
  });

  test('a branch user manager stays in their branch and cannot hand out more access than they hold', async () => {
    const { as } = await loginAll();
    const ids = await lookups(as);
    const grant = (key, scope) => ({ key, scope });
    const role = await as('admin').post('/api/roles', {
      name: 'branch_admin',
      permissions: [
        grant('user.manage', 'branch'),
        grant('deal.view', 'branch'),
        grant('deal.edit', 'own'),
        grant('invoice.view', 'branch'),
        grant('chat.send', 'own'),
      ],
    });
    await createUser(as, 'admin', { email: 'lead@example.com', roleId: role.body.role._id, branchId: ids.branch.DXB });
    const lead = request.agent(app);
    const { token } = (await signIn('lead@example.com')).body;
    const asLead = (method, url, body) => lead[method](url).set('Authorization', `Bearer ${token}`).send(body);

    // sees only their branch
    const listed = (await asLead('get', '/api/users')).body.users;
    assert.ok(listed.length > 0);
    assert.ok(listed.every((u) => u.branch.code === 'DXB'));
    assert.equal((await asLead('patch', `/api/users/${ids.user['exec.b@dealdesk.test']}`, { name: 'x' })).status, 404);

    // the form flags which roles they may give
    const options = (await asLead('get', '/api/users/options')).body;
    const assignable = Object.fromEntries(options.roles.map((r) => [r.name, r.assignable]));
    assert.deepEqual(assignable, { admin: false, branch_admin: true, finance: false, sales_exec: true, sales_manager: false });
    assert.deepEqual(options.branches.map((b) => b.code), ['DXB']);

    // no escalation, no other branch
    const newUser = { name: 'N', password: NEW_PASSWORD, email: 'n@example.com', branchId: ids.branch.DXB };
    const escalate = await asLead('post', '/api/users', { ...newUser, roleId: ids.role.admin });
    assert.equal(escalate.status, 403);
    assert.ok(escalate.body.details.missing.includes('role.manage'));
    assert.equal((await asLead('post', '/api/users', { ...newUser, roleId: ids.role.sales_exec, branchId: ids.branch.AUH })).status, 403);
    assert.equal((await asLead('post', '/api/users', { ...newUser, roleId: ids.role.sales_exec })).status, 201);

    // cannot manage someone with more access, can manage someone with less
    assert.equal((await asLead('patch', `/api/users/${ids.user['admin@dealdesk.test']}`, { active: false })).status, 403);
    assert.equal((await asLead('patch', `/api/users/${ids.user['manager.a@dealdesk.test']}`, { name: 'x' })).status, 403);
    assert.equal((await asLead('patch', `/api/users/${ids.user['exec.a@dealdesk.test']}`, { name: 'Aisha E.' })).status, 200);
    assert.equal((await asLead('patch', `/api/users/${ids.user['exec.a@dealdesk.test']}`, { roleId: ids.role.sales_manager })).status, 403);
  });
});

describe('migrations', () => {
  const adminHasUserManage = async () =>
    (await Role.findOne({ name: 'admin' }).lean()).permissions.filter((p) => p.key === 'user.manage').length;

  test('give an existing admin role user.manage once, and respect a later removal', async () => {
    await Role.updateOne({ name: 'admin' }, { $pull: { permissions: { key: 'user.manage' } } }); // database from before this feature
    await runMigrations();
    assert.equal(await adminHasUserManage(), 1);

    await runMigrations();
    assert.equal(await adminHasUserManage(), 1, 'running again adds nothing');

    await Role.updateOne({ name: 'admin' }, { $pull: { permissions: { key: 'user.manage' } } });
    await runMigrations();
    assert.equal(await adminHasUserManage(), 0, 'an applied migration does not run again');
  });
});
