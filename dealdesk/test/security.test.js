// A browser origin the API should accept (set before the app loads its config).
const UI_ORIGIN = 'https://ui.example.test';
process.env.CORS_ORIGIN = UI_ORIGIN;

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { describe, test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const User = require('../src/modules/users/user.model');
const dealService = require('../src/modules/deals/deal.service');
const { app, useDatabase, loginAll, EMAILS, PASSWORD } = require('./helpers');

useDatabase();
afterEach(() => mock.restoreAll());

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('HTTP hardening', () => {
  test('security headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['strict-transport-security']);
    assert.ok(res.headers['content-security-policy']);
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  test('every response carries a request id', async () => {
    const res = await request(app).get('/health');
    assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  });

  test('CORS answers only the configured origin, and allows DELETE', async () => {
    const allowed = await request(app).options('/api/deals').set('Origin', UI_ORIGIN);
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], UI_ORIGIN);
    assert.match(allowed.headers['access-control-allow-methods'], /DELETE/);
    assert.equal(allowed.headers['access-control-expose-headers'], 'X-Request-Id');

    const other = await request(app).options('/api/deals').set('Origin', 'https://evil.example');
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });

  test('an unexpected error returns a generic message and the request id, never the cause', async () => {
    const { as } = await loginAll();
    mock.method(dealService, 'listDeals', async () => {
      throw new Error('connection string mongodb://user:secret@host');
    });
    const res = await as('execA').get('/api/deals');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Internal server error', requestId: res.headers['x-request-id'] });
  });
});

describe('tokens and passwords', () => {
  test('tokens signed with another algorithm are rejected, even with the right secret', async () => {
    const user = await User.findOne({ email: EMAILS.admin }).lean();
    const hs512 = jwt.sign({ sub: String(user._id) }, env.jwtSecret, { algorithm: 'HS512' });
    const unsigned = jwt.sign({ sub: String(user._id) }, null, { algorithm: 'none' });

    for (const token of [hs512, unsigned]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 401);
    }
  });

  test('an unknown email still runs a password check, so timing does not reveal accounts', async () => {
    const compare = mock.method(bcrypt, 'compare');
    assert.equal((await login('nobody@dealdesk.test', 'whatever')).status, 401);
    assert.equal(compare.mock.callCount(), 1);
  });

  test('password hashes never leave the API', async () => {
    const res = await login(EMAILS.admin, PASSWORD);
    assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
  });

  test('credentials are redacted from log lines', async () => {
    // run the real logger in a child process with logging switched on, and read its output
    const script = `require('./src/common/logger').info({
      req: { headers: { authorization: 'Bearer SECRET_TOKEN', 'x-signature': 'SECRET_SIG' } },
      body: { email: 'a@b.c', password: 'SECRET_PASSWORD' },
    }, 'probe')`;
    const { stdout } = await promisify(execFile)(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, LOG_LEVEL: 'info' },
    });
    assert.match(stdout, /probe/);
    assert.match(stdout, /\[redacted\]/);
    assert.doesNotMatch(stdout, /SECRET_/);
  });
});
