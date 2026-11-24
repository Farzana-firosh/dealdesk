const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, useDatabase, EMAILS, PASSWORD } = require('./helpers');

// Own file (own process): the limiters start empty, whatever other suites do.
useDatabase();

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('rate limits (failed attempts only)', () => {
  test('successful logins are never limited', async () => {
    for (let i = 0; i < 15; i++) assert.equal((await login(EMAILS.execA, PASSWORD)).status, 200);
  });

  test('the 11th failed login in 15 minutes is refused, even with the right password', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await login(EMAILS.execA, 'wrong')).status, 401);

    const blocked = await login(EMAILS.execA, PASSWORD);
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /Too many failed sign-in attempts/);
    assert.ok(blocked.headers.ratelimit, 'standard RateLimit header tells the client when to retry');
  });

  test('a flood of badly signed webhooks is cut off after 30 per minute', async () => {
    const send = () => request(app).post('/webhooks/billport').set('Content-Type', 'application/json').set('X-Signature', 'bad').send('{}');
    for (let i = 0; i < 30; i++) assert.equal((await send()).status, 401);
    assert.equal((await send()).status, 429);
  });
});
