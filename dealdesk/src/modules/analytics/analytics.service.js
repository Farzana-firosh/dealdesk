const Deal = require('../deals/deal.model');
const { scopeFilter } = require('../auth/scope');

const MONTHS = 6;

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const totals = { count: { $sum: 1 }, value: { $sum: '$total' } };
const empty = () => ({ count: 0, value: 0 });

// The deal numbers for everything in the caller's deal.view scope, in one aggregation:
// the pipeline by status now, and won/lost per month for the last six months.
async function dealSummary(user, scope, now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

  const [result] = await Deal.aggregate([
    { $match: scopeFilter(user, scope) },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', ...totals } }],
        closed: [
          { $match: { status: { $in: ['won', 'lost'] }, closedAt: { $gte: since } } },
          { $group: { _id: { status: '$status', month: { $dateToString: { format: '%Y-%m', date: '$closedAt' } } }, ...totals } },
        ],
        lostReasons: [
          { $match: { status: 'lost', closedAt: { $gte: since } } },
          { $group: { _id: '$lostReason', ...totals } },
          { $sort: { count: -1, value: -1 } },
        ],
      },
    },
  ]);

  const byStatus = Object.fromEntries(Deal.DEAL_STATUSES.map((s) => [s, empty()]));
  result.byStatus.forEach(({ _id, count, value }) => {
    byStatus[_id] = { count, value };
  });

  // every month is present, oldest first, so the chart has no gaps
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const key = monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)));
    return { month: key, won: empty(), lost: empty() };
  });
  const byMonth = new Map(months.map((m) => [m.month, m]));
  result.closed.forEach(({ _id, count, value }) => {
    const m = byMonth.get(_id.month);
    if (m) m[_id.status] = { count, value };
  });

  const won = months.reduce((s, m) => s + m.won.count, 0);
  const lost = months.reduce((s, m) => s + m.lost.count, 0);

  return {
    scope,
    byStatus,
    months,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null, // % of deals closed in the period
    lostReasons: result.lostReasons.map(({ _id, count, value }) => ({ reason: _id ?? 'other', count, value })),
  };
}

module.exports = { dealSummary };
