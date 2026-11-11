const http = require('http');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { startInvoiceJobs } = require('./modules/invoices/invoice.jobs');
const { initSocket } = require('./realtime/socket');
const { registerNotificationHandlers } = require('./realtime/notifications');

async function start() {
  await connectDb();
  startInvoiceJobs();

  const server = http.createServer(createApp());
  initSocket(server);
  registerNotificationHandlers();
  server.listen(env.port, () => console.log(`[dealdesk] listening on :${env.port}`));
}

start().catch((err) => {
  console.error('[dealdesk] failed to start', err);
  process.exit(1);
});
