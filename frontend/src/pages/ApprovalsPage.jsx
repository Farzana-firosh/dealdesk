import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../context/SocketContext';
import useAsync from '../hooks/useAsync';
import { Avatar, Badge, Button, Card, Modal, Table, TextArea } from '../components/common';
import { formatDate, formatMoney } from '../utils/format';

function DecisionModal({ decision, onClose, onDone }) {
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const isReject = decision?.action === 'reject';

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/approvals/${decision.request._id}/${decision.action}`, { remarks });
      toast.success(isReject ? 'Request rejected – deal is back to open' : 'Step approved');
      setRemarks('');
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isReject ? 'Reject discount' : 'Approve discount'}
      open={Boolean(decision)}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={isReject ? 'danger' : 'success'} onClick={submit} loading={busy} disabled={isReject && !remarks.trim()}>
            {isReject ? 'Reject' : 'Approve'}
          </Button>
        </>
      }
    >
      {decision && (
        <div className="stack">
          <div className="muted">
            {decision.request.dealId?.title} · {decision.request.discountPercent}% requested by {decision.request.requestedBy?.name}
          </div>
          <TextArea label={isReject ? 'Reason (required)' : 'Remarks (optional)'} value={remarks} onChange={(e) => setRemarks(e.target.value)} autoFocus />
        </div>
      )}
    </Modal>
  );
}

export default function ApprovalsPage() {
  const [decision, setDecision] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get('/approvals/pending'), []);
  useSocketEvent('notification', reload);

  const columns = [
    {
      key: 'deal',
      header: 'Deal',
      render: (r) => (
        <>
          <div className="cell-title">{r.dealId?.title}</div>
          <div className="cell-sub mono">{formatMoney(r.dealId?.subtotal)}</div>
        </>
      ),
    },
    { key: 'pct', header: 'Discount', render: (r) => <Badge tone="warning">{r.discountPercent}%</Badge> },
    {
      key: 'step',
      header: 'Your step',
      render: (r) => `${r.currentStep} of ${r.steps.length} · ${r.steps[r.currentStep - 1].roleName.replace('_', ' ')}`,
    },
    {
      key: 'by',
      header: 'Requested by',
      render: (r) => (
        <div className="row">
          <Avatar name={r.requestedBy?.name} size={26} />
          <div>
            <div>{r.requestedBy?.name}</div>
            <div className="cell-sub">{formatDate(r.createdAt)}</div>
          </div>
        </div>
      ),
    },
    { key: 'remarks', header: 'Remarks', render: (r) => r.remarks || <span className="faint">–</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="cell-actions">
          <Button size="sm" variant="danger" onClick={() => setDecision({ request: r, action: 'reject' })}>Reject</Button>
          <Button size="sm" variant="success" onClick={() => setDecision({ request: r, action: 'approve' })}>Approve</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Waiting on you</h2>
          <p>Only requests whose current step is addressed to your role appear here.</p>
        </div>
        <span className="spacer" />
        <Button icon="refresh" onClick={reload} aria-label="Refresh" />
      </div>
      <Card padded={false}>
        <Table columns={columns} rows={data?.requests} loading={loading && !data} empty="Nothing is waiting on you" />
      </Card>
      <DecisionModal
        decision={decision}
        onClose={() => setDecision(null)}
        onDone={() => {
          setDecision(null);
          reload();
        }}
      />
    </>
  );
}
