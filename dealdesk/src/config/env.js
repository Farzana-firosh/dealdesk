require('dotenv').config({ quiet: true });

// Reads and validates the environment once at start-up. Every problem is collected and
// reported together, so a misconfigured deployment fails immediately with a clear message.
const isProduction = process.env.NODE_ENV === 'production';
const problems = [];

const str = (name, fallback) => process.env[name]?.trim() || fallback;

function num(name, fallback) {
  const value = Number(str(name, fallback));
  if (!Number.isFinite(value) || value <= 0) problems.push(`${name} must be a positive number`);
  return value;
}

// Secrets have no fallback. In production they must not be short or a placeholder.
function secret(name) {
  const value = str(name);
  if (!value) problems.push(`${name} is required`);
  else if (isProduction && (value.length < 32 || /^change-me/i.test(value))) {
    problems.push(`${name} must be at least 32 random characters in production`);
  }
  return value;
}

// In production nothing may silently fall back to localhost.
function setting(name, devFallback) {
  const value = str(name);
  if (!value && isProduction) problems.push(`${name} is required in production`);
  return value || devFallback;
}

const mongoUri = setting('MONGO_URI', 'mongodb://localhost:27017/dealdesk');
// Without a database name the driver uses "test"; the seed would then reset the wrong database.
if (!/^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(mongoUri)) {
  problems.push('MONGO_URI must include the database name, e.g. mongodb+srv://user:pass@host/dealdesk');
}

// Browser origins allowed to call the API (comma separated). Empty in local dev, where the
// Vite proxy makes every request same-origin.
const corsOrigins = setting('CORS_ORIGIN', '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
for (const origin of corsOrigins) {
  let valid = false;
  try { valid = new URL(origin).origin === origin; } catch { /* not a URL: invalid */ }
  if (!valid) problems.push(`CORS_ORIGIN entry "${origin}" must be an origin only, e.g. https://dealdesk-ui.onrender.com`);
}

const env = {
  port: num('PORT', 4000),
  mongoUri,
  corsOrigins,
  jwtSecret: secret('JWT_SECRET'),
  jwtExpiresIn: str('JWT_EXPIRES_IN', '8h'),

  billport: {
    url: setting('BILLPORT_URL', 'http://localhost:5000').replace(/\/+$/, ''), // paths are appended
    secret: secret('BILLPORT_SECRET'),
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

if (problems.length) throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);

module.exports = env;
