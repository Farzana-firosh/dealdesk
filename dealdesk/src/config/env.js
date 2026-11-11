require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable: ${name}`);
  return value;
}

const num = (name, fallback) => Number(process.env[name] || fallback);

module.exports = {
  port: num('PORT', 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/dealdesk',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  billport: {
    url: process.env.BILLPORT_URL || 'http://localhost:5000',
    secret: required('BILLPORT_SECRET'),
    timeoutMs: num('BILLPORT_TIMEOUT_MS', 4000),
  },

  push: {
    maxAttempts: num('PUSH_MAX_ATTEMPTS', 8),
    baseDelayMs: num('PUSH_BASE_DELAY_MS', 2000),
    maxDelayMs: num('PUSH_MAX_DELAY_MS', 60000),
    pollIntervalMs: num('PUSH_POLL_INTERVAL_MS', 1000),
  },

  reconcile: {
    staleMinutes: num('RECONCILE_STALE_MINUTES', 1),
    intervalMs: num('RECONCILE_INTERVAL_MS', 20000),
  },
};
