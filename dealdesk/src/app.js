const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./common/logger');
const { notFound, errorHandler } = require('./common/middleware/errorHandler');
const { cors } = require('./common/middleware/cors');
const { webhookRouter } = require('./modules/invoices/invoice.routes');
require('./database/models');

function createApp() {
  const app = express();

  // On Render the app sits behind one load balancer; trusting exactly that hop makes req.ip the
  // real client address (rate limits depend on it) without letting clients spoof it.
  if (env.isProduction) app.set('trust proxy', 1);

  app.use(helmet());

  // Every request gets an id, returned in X-Request-Id and attached to its log lines.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  // before express.json(): webhook signatures are verified against the raw body
  app.use('/webhooks', webhookRouter);

  app.use('/api', cors); // browser calls from the deployed frontend (webhooks are server-to-server)
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'dealdesk' }));
  app.use('/api', require('./routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
