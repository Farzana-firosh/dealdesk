const crypto = require('crypto');
const { before, beforeEach, after } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { resetAndSeed, seedData, PASSWORD } = require('../src/database/seed');
const env = require('../src/config/env');

const app = createApp();
let mongod;

// One in-memory MongoDB per test file (node --test runs each file in its own process);
// every test starts from the same seeded demo data.
function useDatabase() {
  before(async () => {
    // generous launch timeout: a cold mongod start on Windows (antivirus scan) can take ~10s
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri('dealdesk'));
    await resetAndSeed(); // builds every index once
  });
  beforeEach(async () => {
    // raw driver deleteMany: keeps indexes and bypasses the append-only hooks on approval_history
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    await seedData();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });
}

const EMAILS = {
  execA: 'exec.a@dealdesk.test',
  managerA: 'manager.a@dealdesk.test',
  execB: 'exec.b@dealdesk.test',
  managerB: 'manager.b@dealdesk.test',
  finance: 'finance@dealdesk.test',
  admin: 'admin@dealdesk.test',
};

async function login(who) {
  const res = await request(app).post('/api/auth/login').send({ email: EMAILS[who], password: PASSWORD });
  if (res.status !== 200) throw new Error(`login ${who} failed: ${res.status}`);
  return res.body.token;
}

/** Logs every seeded user in once; returns an `as(who)` helper that builds authenticated requests. */
async function loginAll() {
  const tokens = Object.fromEntries(await Promise.all(Object.keys(EMAILS).map(async (w) => [w, await login(w)])));
  const as = (who) => {
    const agent = request(app);
    const auth = (r) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url) => auth(agent.get(url)),
      post: (url, body = {}) => auth(agent.post(url).send(body)),
      patch: (url, body) => auth(agent.patch(url).send(body)),
      put: (url, body) => auth(agent.put(url).send(body)),
    };
  };
  return { tokens, as };
}

// Creates an open deal owned by `who`, using a customer and product they are allowed to use.
async function createDeal(as, who, { quantity = 1 } = {}) {
  const [customers, products] = await Promise.all([as(who).get('/api/customers'), as(who).get('/api/products')]);
  const res = await as(who).post('/api/deals', {
    title: `Test deal ${crypto.randomUUID().slice(0, 8)}`,
    customerId: customers.body.customers[0]._id,
    items: [{ productId: products.body.products[0]._id, quantity }],
  });
  if (res.status !== 201) throw new Error(`create deal failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.deal;
}

// Signs a webhook body exactly as BillPort does.
function signedWebhook(event, { secret = env.billport.secret } = {}) {
  const raw = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return request(app).post('/webhooks/billport').set('Content-Type', 'application/json').set('X-Signature', signature).send(raw);
}

module.exports = { app, useDatabase, login, loginAll, createDeal, signedWebhook, EMAILS, PASSWORD };
