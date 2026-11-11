const Deal = require('./deal.model');
const Customer = require('../customers/customer.model');
const Product = require('../products/product.model');
const AppError = require('../../common/errors/AppError');
const { scopeFilter } = require('../auth/scope');
const { ensureThread } = require('../chat/chat.service');

const POPULATE = [
  { path: 'customerId', select: 'name email' },
  { path: 'ownerId', select: 'name email' },
  { path: 'branchId', select: 'name code' },
];

async function buildItems(items) {
  const ids = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return items.map(({ productId, quantity }) => {
    const product = byId.get(String(productId));
    if (!product) throw AppError.badRequest(`Unknown product ${productId}`);
    return { productId: product._id, name: product.name, unitPrice: product.price, quantity };
  });
}

async function assertCustomer(customerId) {
  if (!(await Customer.exists({ _id: customerId }))) throw AppError.badRequest('Unknown customer');
}

function listDeals(user, scope, { status } = {}) {
  const filter = { ...scopeFilter(user, scope), ...(status && { status }) };
  return Deal.find(filter).sort({ createdAt: -1 }).populate(POPULATE).lean();
}

// Scope is part of the query: an out-of-scope id behaves exactly like a missing one.
async function getDeal(user, scope, dealId, { populate = true } = {}) {
  const query = Deal.findOne({ _id: dealId, ...scopeFilter(user, scope) });
  const deal = populate ? await query.populate(POPULATE).lean() : await query;
  if (!deal) throw AppError.notFound('Deal not found');
  return deal;
}

async function createDeal(user, { title, customerId, items }) {
  await assertCustomer(customerId);
  const deal = await Deal.create({
    title,
    customerId,
    ownerId: user._id,
    branchId: user.branchId,
    items: await buildItems(items),
  });
  await ensureThread(deal._id); // owner + manager see the thread straight away
  return deal;
}

async function updateDeal(user, scope, dealId, changes) {
  const deal = await getDeal(user, scope, dealId, { populate: false });
  if (deal.status !== 'open') throw AppError.conflict(`Deal is ${deal.status}; only open deals can be edited`);

  if (changes.title) deal.title = changes.title;
  if (changes.customerId) {
    await assertCustomer(changes.customerId);
    deal.customerId = changes.customerId;
  }
  if (changes.items) deal.items = await buildItems(changes.items);

  return deal.save();
}

module.exports = { listDeals, getDeal, createDeal, updateDeal };
