const express = require('express');
const { notFound, errorHandler } = require('./common/middleware/errorHandler');
const { cors } = require('./common/middleware/cors');
const { webhookRouter } = require('./modules/invoices/invoice.routes');
require('./database/models');

function createApp() {
  const app = express();

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
