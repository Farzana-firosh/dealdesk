import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Icon, PageHeader, Table } from '../components/common';
import { countOf, formatDate, formatMoney, formatTime, timeAgo } from '../utils/format';

const REFRESH_MS = 30_000;

// One card per kind of traffic: what each outcome bucket means, in the order worth reading.
const SECTIONS = [
  { key: 'push', title: 'Pushes', icon: 'send', rows: [['succeeded', 'Delivered'], ['retried', 'Retry scheduled'], ['failed', 'Gave up'], ['cancelled', 'Cancelled mid-push']] },
  { key: 'webhook', title: 'Webhooks', icon: 'inbox', rows: [['applied', 'Applied'], ['duplicate', 'Duplicate'], ['stale', 'Out of order'], ['unknownInvoice', 'Unknown invoice'], ['rejected', 'Rejected']] },
  { key: 'reconcile', title: 'Reconciliation', icon: 'refresh', rows: [['inSync', 'Already in sync'], ['repaired', 'Repaired'], ['failed', 'Lookup failed']] },
];
const PROBLEM = new Set(['failed', 'rejected']);

// Status and reasons on the left, the four headline numbers beside it, in one strip.
function Summary({ health }) {
  const { push, pushQueue, webhook } = health;
  const waiting = pushQueue.queued + pushQueue.retrying;
  const ok = health.status === 'ok';
  const metrics = [
    { label: 'Push success', value: push.successRate === null ? '–' : `${push.successRate}%`, sub: push.attempts ? `${push.succeeded}/${push.attempts} · avg ${push.avgMs} ms` : 'no pushes' },
    { label: 'Push queue', value: waiting, sub: `${pushQueue.retrying} retrying · ${pushQueue.failed} failed` },
    { label: 'Webhooks applied', value: webhook.applied, sub: `${health.webhooksWaiting} waiting` },
    { label: 'Awaiting reconcile', value: health.awaitingReconcile, sub: 'no recent update' },
  ];

  return (
    <div className="card health-summary">
      <div className={`health-status ${ok ? 'is-ok' : 'is-degraded'}`}>
        <span className="health-status-icon"><Icon name={ok ? 'check' : 'info'} size={18} /></span>
        <div>
          <b>{ok ? 'All normal' : 'Needs attention'}</b>
          {ok ? <div className="cell-sub">BillPort link is healthy</div> : health.reasons.map((r) => <div key={r} className="cell-sub">{r}</div>)}
        </div>
      </div>
      {metrics.map((m) => (
        <div key={m.label} className="health-metric">
          <span className="stat-label">{m.label}</span>
          <span className="health-metric-value">{m.value}</span>
          <span className="cell-sub">{m.sub}</span>
        </div>
      ))}
    </div>
  );
}

function TrafficCard({ section, counts, last }) {
  const total = section.rows.reduce((n, [bucket]) => n + counts[bucket], 0) + counts.other;
  return (
    <Card title={<span className="row"><Icon name={section.icon} size={15} />{section.title}</span>}
      actions={<span className="faint" title={last ? formatDate(last) : undefined}>{last ? timeAgo(last) : 'no activity'}</span>}>
      <div className="health-lines">
        {section.rows.map(([bucket, label]) => {
          const problem = PROBLEM.has(bucket) && counts[bucket] > 0;
          return (
            <div key={bucket} className={`health-line${problem ? ' is-problem' : ''}`}>
              <span>{label}</span>
              <span className="health-track"><span style={{ width: total ? `${(counts[bucket] / total) * 100}%` : 0 }} /></span>
              <b>{counts[bucket]}</b>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function IntegrationsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data: health, loading, reload } = useAsync(
    async () => ({ ...(await api.get('/integrations/health')), fetchedAt: new Date() }),
    [],
  );

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const retry = async (invoice) => {
    try {
      await api.post(`/invoices/${invoice._id}/retry-push`);
      toast.success(`${invoice.number} re-queued`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const header = (
    <PageHeader title="Integration health">
      {health && <span className="faint">Last {health.windowHours} h · updated {formatTime(health.fetchedAt)}</span>}
      <Button icon="refresh" onClick={reload} aria-label="Refresh" />
    </PageHeader>
  );

  if (!health) {
    return <>{header}<Card>{loading ? <div className="empty">Loading…</div> : <EmptyState icon="info" title="Could not load integration health">Check your connection and refresh.</EmptyState>}</Card></>;
  }

  const columns = [
    { key: 'number', header: 'Invoice', render: (i) => <span className="cell-title mono">{i.number}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (i) => <span className="mono">{formatMoney(i.amount)}</span> },
    { key: 'error', header: 'Last error', render: (i) => i.pushError || '–' },
    { key: 'attempts', header: 'Attempts', align: 'right', render: (i) => i.pushAttempts },
    { key: 'updated', header: 'Gave up', render: (i) => <span className="muted" title={formatDate(i.updatedAt)}>{timeAgo(i.updatedAt)}</span> },
    {
      key: 'actions', header: '', align: 'right',
      render: (i) => can('invoice.issue') && <Button size="sm" variant="primary" onClick={() => retry(i)}>Retry push</Button>,
    },
  ];

  return (
    <>
      {header}
      <Summary health={health} />

      <div className="health-traffic">
        {SECTIONS.map((s) => <TrafficCard key={s.key} section={s} counts={health[s.key]} last={health.lastActivity[s.key]} />)}
      </div>

      <Card padded={false} className="health-failed"
        title={<span className="row">Gave up pushing {health.failedInvoices.length > 0 && <Badge tone="danger">{health.pushQueue.failed}</Badge>}</span>}
        actions={<Link to="/invoices" className="card-link">All invoices <Icon name="arrowRight" size={14} /></Link>}>
        {health.failedInvoices.length ? <Table columns={columns} rows={health.failedInvoices} /> : (
          <div className="health-none"><Icon name="check" size={16} />Every invoice reached BillPort</div>
        )}
      </Card>
    </>
  );
}
