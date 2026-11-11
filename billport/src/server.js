const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');
const routes = require('./routes');
const { startLifecycle } = require('./lifecycle');

const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'billport' }));
app.use(routes);
app.use((err, req, res, next) => {
  console.error('[billport]', err);
  res.status(500).json({ error: 'Internal error' });
});

async function start() {
  await mongoose.connect(config.mongoUri);
  startLifecycle();
  app.listen(config.port, () => console.log(`[billport] listening on :${config.port}`));
}

start().catch((err) => {
  console.error('[billport] failed to start', err);
  process.exit(1);
});
