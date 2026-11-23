const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerNotificationHandlers } = require('../src/realtime/notifications');
const request = require('supertest');
const { app, useDatabase, loginAll, createDeal } = require('./helpers');

useDatabase();
before(() => registerNotificationHandlers()); // server.js does this at start-up; no sockets are connected here

// Event handlers run after the request has answered, so wait for the stored result.
async function eventually(check, { timeoutMs = 3000 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > until) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const inbox = async (as, who) => (await as(who).get('/api/notifications')).body;
const hasType = (as, who, type, count = 1) =>
  eventually(async () => {
    const box = await inbox(as, who);
    return box.notifications.filter((n) => n.type === type).length >= count && box;
  });

describe('stored notifications', () => {
  test('reach only the right users, even with nobody connected', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { body } = await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 30, remarks: 'big order' });

    const manager = await hasType(as, 'managerA', 'discount.requested');
    assert.equal(manager.unread, 1);
    assert.equal(manager.notifications[0].read, false);
    assert.equal(manager.notifications[0].data.dealTitle, deal.title);
    assert.equal(manager.notifications[0].data.step, 1);

    // other branch and later steps hear nothing yet
    assert.equal((await inbox(as, 'managerB')).notifications.length, 0);
    assert.equal((await inbox(as, 'finance')).notifications.length, 0);

    await as('managerA').post(`/api/approvals/${body.request._id}/approve`, { remarks: 'ok' });

    const requester = await hasType(as, 'execA', 'discount.decided');
    assert.equal(requester.notifications[0].data.requestStatus, 'pending');

    // the next approver is told which deal, although the approval does not load the deal
    const finance = await hasType(as, 'finance', 'discount.requested');
    assert.equal(finance.notifications[0].data.dealTitle, deal.title);
    assert.equal(finance.notifications[0].data.step, 2);
  });

  test('marking read affects only the caller', async () => {
    const { as } = await loginAll();
    const deal = await createDeal(as, 'execA');
    const { body } = await as('execA').post(`/api/deals/${deal._id}/discount-request`, { discountPercent: 30, remarks: 'x' });
    await hasType(as, 'managerA', 'discount.requested');
    await as('managerA').post(`/api/approvals/${body.request._id}/approve`, {});
    await hasType(as, 'execA', 'discount.decided');

    assert.equal((await as('managerA').post('/api/notifications/read')).status, 204);
    const manager = await inbox(as, 'managerA');
    assert.equal(manager.unread, 0);
    assert.ok(manager.notifications.every((n) => n.read));

    assert.equal((await inbox(as, 'execA')).unread, 1);
  });

  test('need a signed-in user', async () => {
    assert.equal((await request(app).get('/api/notifications')).status, 401);
  });
});
