const invoiceService = require('./invoice.service');
const webhookService = require('./webhook.service');

async function convert(req, res) {
  const { sale, invoice } = await invoiceService.convertDeal(req.user, req.scope, req.params.id);
  res.status(201).json({ sale, invoice });
}

async function list(req, res) {
  const invoices = await invoiceService.listInvoices(req.user, req.scope, { status: req.query.status });
  res.json({ count: invoices.length, invoices });
}

async function getOne(req, res) {
  res.json({ invoice: await invoiceService.getInvoice(req.user, req.scope, req.params.id) });
}

async function logs(req, res) {
  res.json({ logs: await invoiceService.getLogs(req.user, req.scope, req.params.id) });
}

async function retryPush(req, res) {
  res.json({ invoice: await invoiceService.retryPush(req.user, req.scope, req.params.id) });
}

async function cancel(req, res) {
  res.json({ invoice: await invoiceService.cancelInvoice(req.user, req.scope, req.params.id) });
}

// Answer first, process after: BillPort retries if we take longer than 3s.
async function billportWebhook(req, res) {
  const result = await webhookService.receive(req.body, req.get('X-Signature'));
  res.status(result.status).json({ received: result.status === 200 });

  if (result.eventId) {
    setImmediate(() => webhookService.processEvent(result.eventId).catch((err) => console.error('[webhook]', err)));
  }
}

module.exports = { convert, list, getOne, logs, retryPush, cancel, billportWebhook };
