const http = require('http');
const env = require('./config/env');
const logger = require('./common/logger');
const { connectDb } = require('./config/db');
const { runMigrations } = require('./database/migrate');
const { createApp } = require('./app');
const { startInvoiceJobs } = require('./modules/invoices/invoice.jobs');
const { initSocket } = require('./realtime/socket');
const { registerNotificationHandlers } = require('./realtime/notifications');

async function start() {
  await connectDb();
  await runMigrations();
  startInvoiceJobs();

  const server = http.createServer(createApp());
  initSocket(server);
  registerNotificationHandlers();
  server.listen(env.port, () => logger.info({ port: env.port }, 'dealdesk listening'));
}

start().catch((err) => {
  logger.fatal({ err }, 'dealdesk failed to start');
  process.exit(1);
});
