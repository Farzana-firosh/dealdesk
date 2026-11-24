const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const Invoice = require('../src/modules/invoices/invoice.model');
const IntegrationLog = require('../src/modules/invoices/integration-log.model');
const Role = require('../src/modules/roles/role.model');
const { runMigrations } = require('../src/database/migrate');
const { useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();

const log = (action, outcome, extra = {}) =>
  IntegrationLog.create({ action, outcome, direction: action === 'webhook' ? 'inbound' : 'outbound', ...extra });

describe('integration health', () => {
  test('needs integration.view: admin gets it, finance does not', async () => {
    const { as } = await loginAll();
    assert.equal((await as('finance').get('/api/integrations/health')).status, 403);

    const res = await as('admin').get('/api/integrations/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.push.attempts, 0);
    assert.equal(res.body.push.successRate, null);
  });

  test('buckets the last 24 hours of outcomes and explains why it is degraded', async () => {
    const { as } = await loginAll();
    await Promise.all([
      log('push', 'success', { durationMs: 100 }),
      log('push', 'success', { durationMs: 200 }),
      log('push', 'success', { durationMs: 300 }),
      log('push', 'retry_scheduled_in_4s', { durationMs: 400 }),
      log('webhook', 'applied'),
      log('webhook', 'duplicate_ignored'),
      log('webhook', 'rejected_invalid_signature'),
      log('reconcile', 'repaired sent -> paid'),
    ]);
    // older than the window: counted nowhere (raw insert, so createdAt is not overwritten)
    await IntegrationLog.collection.insertOne({ action: 'push', direction: 'outbound', outcome: 'failed_terminal', createdAt: new Date(Date.now() - 48 * 3600_000) });

    const { body } = await as('admin').get('/api/integrations/health');
    assert.deepEqual(
      { attempts: body.push.attempts, succeeded: body.push.succeeded, retried: body.push.retried, failed: body.push.failed },
      { attempts: 4, succeeded: 3, retried: 1, failed: 0 },
    );
    assert.equal(body.push.successRate, 75);
    assert.equal(body.push.avgMs, 250);
    assert.equal(body.webhook.applied, 1);
    assert.equal(body.webhook.duplicate, 1);
    assert.equal(body.webhook.rejected, 1);
    assert.equal(body.reconcile.repaired, 1);
    assert.equal(body.status, 'degraded');
    assert.equal(body.reasons.length, 2); // push rate under 80% and a rejected webhook
    assert.ok(body.lastActivity.push);
  });

  test('lists invoices that gave up pushing', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 5 });
    const { invoice } = (await as('finance').post(`/api/deals/${deal._id}/convert`)).body;
    await Invoice.updateOne({ _id: invoice._id }, { pushStatus: 'failed', pushError: 'HTTP 422' });

    const { body } = await as('admin').get('/api/integrations/health');
    assert.equal(body.pushQueue.failed, 1);
    assert.equal(body.failedInvoices[0].number, invoice.number);
    assert.equal(body.failedInvoices[0].pushError, 'HTTP 422');
    assert.equal(body.status, 'degraded');
  });

  test('integration logs expire after 90 days', async () => {
    const indexes = await IntegrationLog.collection.indexes();
    const ttl = indexes.find((i) => i.key.createdAt === 1 && 'expireAfterSeconds' in i);
    assert.equal(ttl?.expireAfterSeconds, 90 * 24 * 60 * 60);
  });

  test('the migration gives an existing admin role integration.view once', async () => {
    await Role.updateOne({ name: 'admin' }, { $pull: { permissions: { key: 'integration.view' } } });
    await runMigrations();
    await runMigrations();
    const admin = await Role.findOne({ name: 'admin' }).lean();
    assert.equal(admin.permissions.filter((p) => p.key === 'integration.view').length, 1);
  });
});
