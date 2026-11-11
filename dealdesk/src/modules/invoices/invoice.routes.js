const express = require('express');
const { authorize } = require('../auth/auth.middleware');
const controller = require('./invoice.controller');

const invoiceRouter = express.Router();
invoiceRouter.get('/', authorize('invoice.view'), controller.list);
invoiceRouter.get('/:id', authorize('invoice.view'), controller.getOne);
invoiceRouter.get('/:id/logs', authorize('invoice.view'), controller.logs);
invoiceRouter.post('/:id/retry-push', authorize('invoice.issue'), controller.retryPush);
invoiceRouter.post('/:id/cancel', authorize('invoice.cancel'), controller.cancel);

// Mounted before express.json(): the signature is checked against the raw bytes,
// so the body must not be parsed (and re-serialised) first.
const webhookRouter = express.Router();
webhookRouter.post('/billport', express.raw({ type: '*/*', limit: '100kb' }), controller.billportWebhook);

module.exports = { invoiceRouter, webhookRouter };
