const crypto = require('crypto');
const express = require('express');
const config = require('./config');
const { chaos } = config;
const { Invoice, Delivery } = require('./models');
const { verify } = require('./hmac');
const { randomStepMs } = require('./lifecycle');

const router = express.Router();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findOrCreate(idempotencyKey, payload) {
  const existing = await Invoice.findOne({ idempotencyKey });
  if (existing) return existing;
  try {
    return await Invoice.create({
      idempotencyKey,
      externalId: `bp_${crypto.randomUUID()}`,
      payload,
      nextTransitionAt: new Date(Date.now() + randomStepMs()),
    });
  } catch (err) {
    // two concurrent requests with the same key: the unique index lets only one insert win
    if (err.code === 11000) return Invoice.findOne({ idempotencyKey });
    throw err;
  }
}

router.post('/billing/invoices', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!verify(req.body, req.get('X-Signature'), config.secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const key = req.get('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });

  const roll = Math.random();
  if (roll < chaos.failRate) {
    console.log(`[billport] POST invoice key=${key} -> 503 (chaos)`);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const invoice = await findOrCreate(key, JSON.parse(req.body));

  if (roll < chaos.failRate + chaos.slowRate) {
    console.log(`[billport] POST invoice key=${key} -> slow response (${chaos.slowMs}ms)`);
    await sleep(chaos.slowMs);
  }

  console.log(`[billport] POST invoice key=${key} -> 201 ${invoice.externalId}`);
  res.status(201).json({ externalId: invoice.externalId, status: 'QUEUED' });
});

router.get('/billing/invoices/:externalId', async (req, res) => {
  const invoice = await Invoice.findOne({ externalId: req.params.externalId });
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  res.json({ externalId: invoice.externalId, status: invoice.status, updatedAt: invoice.updatedAt });
});

// --- demo / inspection endpoints (not part of the billing contract) ---
// Protected by the X-Admin-Token header when ADMIN_TOKEN is set (always in production).
function requireAdmin(req, res, next) {
  if (!config.adminToken) return next();
  const given = Buffer.from(req.get('X-Admin-Token') || '');
  const expected = Buffer.from(config.adminToken);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  next();
}
router.use('/admin', requireAdmin);

router.get('/admin/chaos', (req, res) => res.json(chaos));
router.post('/admin/chaos', express.json(), (req, res) => {
  for (const [k, v] of Object.entries(req.body)) if (k in chaos) chaos[k] = v;
  console.log('[billport] chaos updated', chaos);
  res.json(chaos);
});
router.get('/admin/invoices', async (req, res) => {
  res.json(await Invoice.find().sort({ createdAt: -1 }).limit(50).lean());
});
router.get('/admin/deliveries', async (req, res) => {
  const filter = req.query.externalId ? { externalId: req.query.externalId } : {};
  res.json(await Delivery.find(filter).sort({ createdAt: -1 }).limit(100).lean());
});

module.exports = router;
