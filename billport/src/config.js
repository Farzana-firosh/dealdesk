require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/billport',
  secret: process.env.BILLPORT_SECRET || 'billport-shared-secret',
  webhookUrl: process.env.DEALDESK_WEBHOOK_URL || 'http://localhost:4000/webhooks/billport',
  webhookTimeoutMs: 3000,
  webhookMaxAttempts: 5,
};

// Misbehaviour knobs. Mutable at runtime via POST /admin/chaos (useful for demos).
module.exports.chaos = {
  failRate: 0.15, // POST /billing/invoices -> 503
  slowRate: 0.1, // POST /billing/invoices -> respond after slowMs
  slowMs: 6000,
  duplicateRate: 0.2, // webhook delivered twice with the same eventId
  outOfOrderRate: 0.25, // VIEWED held back until after the final event
  badSignatureRate: 0.1, // first delivery attempt signed with the wrong secret
  minStepSec: 5, // random gap between lifecycle steps
  maxStepSec: 30,
  webhooksEnabled: true, // false = drop every webhook (reconciliation demo)
};
