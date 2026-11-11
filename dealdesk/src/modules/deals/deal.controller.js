const dealService = require('./deal.service');

async function list(req, res) {
  const deals = await dealService.listDeals(req.user, req.scope, { status: req.query.status });
  res.json({ scope: req.scope, count: deals.length, deals });
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

module.exports = { list, getOne, create, update };
