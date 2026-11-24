const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ?page=&limit= from a query string. Missing or nonsense values fall back to the defaults
// rather than erroring, and the limit is capped so one request cannot pull a whole collection.
function pageParams(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit };
}

/**
 * Runs `query` (a find() not yet executed) for one page and counts the whole filter alongside.
 * Returns the rows plus { page, limit, total, pages }.
 */
async function paginate(query, model, filter, { page, limit }) {
  const [items, total] = await Promise.all([
    query.skip((page - 1) * limit).limit(limit).lean(),
    model.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { pageParams, paginate, DEFAULT_LIMIT, MAX_LIMIT };
