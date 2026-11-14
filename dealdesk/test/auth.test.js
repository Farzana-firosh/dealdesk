const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const User = require('../src/modules/users/user.model');
const { app, useDatabase, loginAll, EMAILS, PASSWORD } = require('./helpers');

useDatabase();

const loginAs = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('authentication', () => {
  test('valid login returns a token and the principal with role permissions', async () => {
    const res = await loginAs(EMAILS.execA, PASSWORD);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.role.name, 'sales_exec');
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('email is case-insensitive', async () => {
    assert.equal((await loginAs(EMAILS.execA.toUpperCase(), PASSWORD)).status, 200);
  });

  test('wrong password and unknown email give the same 401', async () => {
    const wrong = await loginAs(EMAILS.execA, 'nope');
    const unknown = await loginAs('ghost@dealdesk.test', PASSWORD);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });

  test('invalid body is a 400 with details', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.length > 0);
  });

  test('protected routes need a valid bearer token', async () => {
    assert.equal((await request(app).get('/api/deals')).status, 401);
    assert.equal((await request(app).get('/api/deals').set('Authorization', 'Bearer garbage')).status, 401);
    assert.equal((await request(app).get('/api/deals').set('Authorization', 'Basic abc')).status, 401);
  });

  test('a deactivated user is locked out immediately, even with a valid token', async () => {
    const { as } = await loginAll();
    assert.equal((await as('execA').get('/api/auth/me')).status, 200);

    await User.updateOne({ email: EMAILS.execA }, { active: false });
    assert.equal((await as('execA').get('/api/auth/me')).status, 401);
    assert.equal((await loginAs(EMAILS.execA, PASSWORD)).status, 401);
  });
});

describe('permissions', () => {
  test('only role.manage holders can manage roles', async () => {
    const { as } = await loginAll();
    assert.equal((await as('execA').get('/api/roles')).status, 403);
    assert.equal((await as('admin').get('/api/roles')).status, 200);
  });

  test('permission changes apply on the next request without a new login', async () => {
    const { as } = await loginAll();
    const exec = (await as('admin').get('/api/roles')).body.roles.find((r) => r.name === 'sales_exec');

    const res = await as('admin').patch(`/api/roles/${exec._id}`, {
      permissions: exec.permissions.filter((p) => p.key !== 'deal.view'),
    });
    assert.equal(res.status, 200);
    assert.equal((await as('execA').get('/api/deals')).status, 403);
  });

  test('unknown permission keys are rejected', async () => {
    const { as } = await loginAll();
    const res = await as('admin').post('/api/roles', { name: 'auditor', permissions: [{ key: 'everything', scope: 'all' }] });
    assert.equal(res.status, 400);
  });

  test('finance cannot create deals (no deal.edit)', async () => {
    const { as } = await loginAll();
    const id = '0'.repeat(24);
    const res = await as('finance').post('/api/deals', { title: 'x', customerId: id, items: [{ productId: id, quantity: 1 }] });
    assert.equal(res.status, 403);
  });
});
