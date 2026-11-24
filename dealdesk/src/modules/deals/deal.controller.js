const dealService = require('./deal.service');
const { pageParams } = require('../../common/utils/paginate');

async function list(req, res) {
  const { items, ...pageInfo } = await dealService.listDeals(req.user, req.scope, { status: req.query.status, ...pageParams(req.query) });
  res.json({ scope: req.scope, count: items.length, ...pageInfo, deals: items });
}

async function getOne(req, res) {
  res.json({ deal: await dealService.getDeal(req.user, req.scope, req.params.id) });
}

async function create(req, res) {
  res.status(201).json({ deal: await dealService.createDeal(req.user, req.body) });
}

async function update(req, res) {
  res.json({ deal: await dealService.updateDeal(req.user, req.scope, req.params.id, req.body) });
}

async function markLost(req, res) {
  res.json({ deal: await dealService.markLost(req.user, req.scope, req.params.id, req.body) });
}

module.exports = { list, getOne, create, update, markLost };
