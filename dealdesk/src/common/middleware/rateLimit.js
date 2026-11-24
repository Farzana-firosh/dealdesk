const { rateLimit } = require('express-rate-limit');

// Both limits count failed requests only, so real users and BillPort's valid webhooks are
// never throttled; only guessing (passwords, signatures) is. Counters live in memory, which
// is right for a single instance; several instances would need a shared store (e.g. Redis).
function failureLimit({ windowMs, limit, error }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error },
  });
}

const loginLimit = failureLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  error: 'Too many failed sign-in attempts. Try again in 15 minutes.',
});

const webhookLimit = failureLimit({
  windowMs: 60_000,
  limit: 30,
  error: 'Too many rejected webhook requests',
});

module.exports = { loginLimit, webhookLimit };
