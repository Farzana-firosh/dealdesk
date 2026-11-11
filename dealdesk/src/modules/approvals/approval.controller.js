const approvalService = require('./approval.service');
const configService = require('./approval-config.service');

async function requestDiscount(req, res) {
  const request = await approvalService.requestDiscount(req.user, req.scope, req.params.id, req.body);
  res.status(201).json({ request });
}

async function dealHistory(req, res) {
  res.json(await approvalService.historyForDeal(req.user, req.scope, req.params.id));
}

async function pending(req, res) {
  const requests = await approvalService.pendingFor(req.user, req.scope);
  res.json({ count: requests.length, requests });
}

async function approve(req, res) {
  res.json({ request: await approvalService.decide(req.user, req.scope, req.params.id, 'approved', req.body.remarks) });
}

async function reject(req, res) {
  res.json({ request: await approvalService.decide(req.user, req.scope, req.params.id, 'rejected', req.body.remarks) });
}

async function getConfig(req, res) {
  res.json({ config: await configService.getConfig() });
}

async function replaceConfig(req, res) {
  res.json({ config: await configService.replaceConfig(req.user, req.body.bands) });
}

module.exports = { requestDiscount, dealHistory, pending, approve, reject, getConfig, replaceConfig };
