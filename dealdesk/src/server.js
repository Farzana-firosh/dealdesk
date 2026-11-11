const http = require('http');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');

async function start() {
  await connectDb();

  const server = http.createServer(createApp());
  server.listen(env.port, () => console.log(`[dealdesk] listening on :${env.port}`));
}

start().catch((err) => {
  console.error('[dealdesk] failed to start', err);
  process.exit(1);
});
