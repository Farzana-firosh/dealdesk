require('dotenv').config({ quiet: true });

// Read once at start-up. In local dev everything has a demo default; in production every value
// must be set explicitly (no demo secret, no localhost) and all problems are reported together.
const isProduction = process.env.NODE_ENV === 'production';
const problems = [];

const str = (name) => process.env[name]?.trim() || '';

function setting(name, devFallback) {
  const value = str(name);
  if (!value && isProduction) problems.push(`${name} is required in production`);
  return value || devFallback;
}

function secret(name, devFallback) {
  const value = setting(name, devFallback);
  if (isProduction && value && value.length < 32) problems.push(`${name} must be at least 32 random characters in production`);
  return value;
}

const config = {
  port: Number(str('PORT') || 5000),
  mongoUri: setting('MONGO_URI', 'mongodb://localhost:27017/billport'),
  secret: secret('BILLPORT_SECRET', 'billport-shared-secret'),
  webhookUrl: setting('DEALDESK_WEBHOOK_URL', 'http://localhost:4000/webhooks/billport'),
  // /admin/* requires the X-Admin-Token header when set. Empty = open (local dev and tests only).
  adminToken: secret('ADMIN_TOKEN', ''),
  webhookTimeoutMs: 3000,
  webhookMaxAttempts: 5,
};

if (problems.length) throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);

module.exports = config;

// Misbehaviour knobs. Mutable at runtime via POST /admin/chaos (useful for demos).
module.exports.chaos = {
  failRate: 0.15, // POST /billing/invoices -> 503
  slowRate: 0.1, // POST /billing/invoices -> respond after slowMs
  slowMs: 6000,
  duplicateRate: 0.2, // webhook delivered twice with the same eventId
  outOfOrderRate: 0.25, // VIEWED held back until after the final event
  badSignatureRate: 0.1, // first delivery attempt signed with the wrong secret
  paidRate: 0.8, // VIEWED -> PAID, otherwise FAILED
  minStepSec: 5, // random gap between lifecycle steps
  maxStepSec: 30,
  webhooksEnabled: true, // false = drop every webhook (reconciliation demo)
};
