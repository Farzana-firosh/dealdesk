import { api } from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import { Button, Card, EmptyState } from '../../components/common';
import { formatMoney, LOST_REASONS } from '../../utils/format';
import MonthlyChart from './MonthlyChart';

const deals = (n) => `${n} deal${n === 1 ? '' : 's'}`;

const SCOPE_TEXT = { own: 'Your deals', branch: 'Every deal in your branch', all: 'Deals across all branches' };

function Stat({ label, value, sub }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="cell-sub">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, loading, reload } = useAsync(() => api.get('/analytics/deals'), []);
  useSocketEvent('notification', reload); // approvals change won counts

  const s = data?.byStatus;
  const sum = (key) => data?.months.reduce((n, m) => n + m[key].count, 0) ?? 0;
  const sumValue = (key) => data?.months.reduce((n, m) => n + m[key].value, 0) ?? 0;
  const closed = sum('won') + sum('lost');
  const topReason = data?.lostReasons[0];
  const maxReason = Math.max(1, ...(data?.lostReasons.map((r) => r.count) ?? []));

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Analytics</h2>
          <p>{data ? `${SCOPE_TEXT[data.scope]} · won and lost over the last six months` : ' '}</p>
        </div>
        <span className="spacer" />
        <Button icon="refresh" onClick={reload} aria-label="Refresh" />
      </div>

      {loading && !data ? (
        <Card><div className="muted">Loading…</div></Card>
      ) : data && (
        <>
          <div className="stat-grid">
            <Stat label="Open pipeline" value={formatMoney(s.open.value + s.pending_approval.value)}
              sub={`${deals(s.open.count + s.pending_approval.count)} · ${s.pending_approval.count} awaiting approval`} />
            <Stat label="Won · 6 months" value={formatMoney(sumValue('won'))} sub={deals(sum('won'))} />
            <Stat label="Win rate · 6 months" value={data.winRate === null ? '–' : `${data.winRate}%`}
              sub={closed ? `of ${deals(closed)} closed` : 'No deals closed yet'} />
            <Stat label="Lost · 6 months" value={sum('lost')}
              sub={topReason ? `Most often: ${LOST_REASONS[topReason.reason].toLowerCase()}` : 'None lost'} />
          </div>

          <div className="analytics-grid">
            <Card title="Won and lost per month">
              {closed ? <MonthlyChart months={data.months} /> : (
                <EmptyState icon="chart" title="No closed deals yet">Deals appear here once they are won or marked lost.</EmptyState>
              )}
            </Card>

            <Card title="Why deals were lost">
              {data.lostReasons.length ? (
                <div className="reason-list">
                  {data.lostReasons.map((r) => (
                    <div key={r.reason} className="reason-row">
                      <div className="row">
                        <span>{LOST_REASONS[r.reason]}</span>
                        <span className="spacer" />
                        <b>{r.count}</b>
                        <span className="cell-sub mono">{formatMoney(r.value)}</span>
                      </div>
                      <div className="reason-track"><div style={{ width: `${(r.count / maxReason) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="chart" title="No lost deals">Reasons are recorded when a deal is marked lost.</EmptyState>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
