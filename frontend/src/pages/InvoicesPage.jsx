import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../context/SocketContext';
import useAsync from '../hooks/useAsync';
import { Badge, Button, Card, Modal, StatusBadge, Table } from '../components/common';
import { formatDate, formatMoney } from '../utils/format';

const OUTCOME_TONE = (o) =>
  o === 'success' || o === 'applied' || o.startsWith('repaired') ? 'success'
    : o.includes('ignored') || o.startsWith('retry') || o.startsWith('in_sync') ? 'warning'
      : o.startsWith('rejected') || o.startsWith('failed') ? 'danger' : 'default';

function LogsModal({ invoice, onClose }) {
  const { data, loading } = useAsync(() => (invoice ? api.get(`/invoices/${invoice._id}/logs`) : Promise.resolve(null)), [invoice]);

  const columns = [
    { key: 'at', header: 'Time', render: (l) => <span className="mono">{new Date(l.createdAt).toLocaleTimeString()}</span> },
    { key: 'action', header: 'Action', render: (l) => <><b>{l.action}</b><div className="cell-sub">{l.direction}</div></> },
    {
      key: 'detail',
      header: 'Detail',
      render: (l) =>
        l.action === 'push' ? `attempt ${l.request?.attempt} → ${l.response?.status ?? l.error}`
          : l.action === 'webhook' ? `${l.request?.status} · seq ${l.request?.sequence}`
            : `BillPort says ${l.response?.body?.status ?? l.error}`,
    },
    { key: 'outcome', header: 'Outcome', render: (l) => <Badge tone={OUTCOME_TONE(l.outcome)}>{l.outcome}</Badge> },
    { key: 'ms', header: 'ms', align: 'right', render: (l) => <span className="muted">{l.durationMs ?? ''}</span> },
  ];

  return (
    <Modal title={invoice ? `Integration log · ${invoice.number}` : ''} open={Boolean(invoice)} onClose={onClose} size="lg">
      <p className="muted" style={{ marginTop: 0 }}>Every push attempt, webhook and reconciliation for this invoice – the answer to “why does it say unpaid?”.</p>
      <div className="card">
        <Table columns={columns} rows={data?.logs} loading={loading} empty="No integration activity yet" />
      </div>
    </Modal>
  );
}

export default function InvoicesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [logsFor, setLogsFor] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get('/invoices'), []);
  useSocketEvent('notification', reload);

  const act = async (path, message) => {
    try {
      await api.post(path);
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const invoices = data?.invoices || [];
  const outstanding = invoices.filter((i) => ['pending', 'sent', 'viewed'].includes(i.status)).reduce((s, i) => s + i.amount, 0);

  const columns = [
    { key: 'number', header: 'Invoice', render: (i) => (<><div className="cell-title mono">{i.number}</div><div className="cell-sub">{i.customerId?.name}</div></>) },
    { key: 'amount', header: 'Amount', align: 'right', render: (i) => <span className="mono">{formatMoney(i.amount)}</span> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    {
      key: 'push',
      header: 'BillPort push',
      render: (i) => (
        <>
          <StatusBadge status={i.pushStatus} />
          <div className="cell-sub">{i.pushAttempts} attempt{i.pushAttempts === 1 ? '' : 's'}{i.pushError ? ` · ${i.pushError}` : ''}</div>
        </>
      ),
    },
    { key: 'updated', header: 'Status updated', render: (i) => <span className="muted">{formatDate(i.statusUpdatedAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <div className="cell-actions">
          <Button size="sm" onClick={() => setLogsFor(i)}>Logs</Button>
          {i.pushStatus === 'failed' && can('invoice.issue') && (
            <Button size="sm" variant="primary" onClick={() => act(`/invoices/${i._id}/retry-push`, 'Push re-queued')}>Retry push</Button>
          )}
          {['pending', 'sent', 'viewed'].includes(i.status) && can('invoice.cancel') && (
            <Button size="sm" variant="danger" onClick={() => act(`/invoices/${i._id}/cancel`, 'Invoice cancelled')}>Cancel</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Invoices</h2>
          <p>Status is kept in sync with BillPort automatically (webhooks + reconciliation).</p>
        </div>
        <span className="spacer" />
        <Button icon="refresh" onClick={reload} aria-label="Refresh" />
      </div>

      <div className="stat-grid">
        <div className="card stat"><div className="stat-label">Invoices</div><div className="stat-value">{invoices.length}</div></div>
        <div className="card stat"><div className="stat-label">Paid</div><div className="stat-value">{invoices.filter((i) => i.status === 'paid').length}</div></div>
        <div className="card stat"><div className="stat-label">Outstanding</div><div className="stat-value mono" style={{ fontSize: 20 }}>{formatMoney(outstanding)}</div></div>
        <div className="card stat"><div className="stat-label">Push failed</div><div className="stat-value">{invoices.filter((i) => i.pushStatus === 'failed').length}</div></div>
      </div>

      <Card padded={false}>
        <Table columns={columns} rows={invoices} loading={loading && !data} empty="No invoices yet – convert a won deal" />
      </Card>
      <LogsModal invoice={logsFor} onClose={() => setLogsFor(null)} />
    </>
  );
}
