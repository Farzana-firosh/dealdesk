const pino = require('pino');
const env = require('../config/env');

// One JSON line per event (Render's log viewer and any log tool can search the fields).
// Credentials are redacted at the source, so they can never reach the logs by accident.
const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-signature"]',
      'req.headers["x-admin-token"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[redacted]',
  },
});

module.exports = logger;
