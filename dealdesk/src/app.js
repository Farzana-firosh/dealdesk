const path = require('path');
const express = require('express');
const { notFound, errorHandler } = require('./common/middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'dealdesk' }));
  app.use('/api', require('./routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
