import { api } from '../../api/client';
import useAsync from '../../hooks/useAsync';
import { Modal, StatusBadge, Table } from '../../components/common';
import ApprovalSteps from '../../components/ApprovalSteps';
import { formatDate } from '../../utils/format';

const columns = [
  { key: 'step', header: 'Step', render: (h) => (h.step === 0 ? '–' : h.step) },
  { key: 'action', header: 'Action', render: (h) => <StatusBadge status={h.action} /> },
  { key: 'approverRole', header: 'Role', render: (h) => h.approverRole.replace('_', ' ') },
  { key: 'by', header: 'By', render: (h) => h.approverId?.name },
  { key: 'remarks', header: 'Remarks', render: (h) => h.remarks || <span className="faint">–</span> },
  { key: 'timestamp', header: 'When', render: (h) => <span className="muted">{formatDate(h.timestamp)}</span> },
];

function HistoryBody({ dealId }) {
  const { data, loading } = useAsync(() => api.get(`/deals/${dealId}/approvals`), [dealId]);
  if (loading) return <div className="empty">Loading…</div>;
  const latest = data.requests[0];

  return (
    <div className="stack">
      {latest && (
        <div>
          <div className="section-title">Latest request · {latest.discountPercent}% · <StatusBadge status={latest.status} /></div>
          <ApprovalSteps request={latest} />
        </div>
      )}
      <div>
        <div className="section-title">Audit trail (append-only)</div>
        <div className="card">
          <Table columns={columns} rows={data.history} empty="No discount requested yet" />
        </div>
      </div>
    </div>
  );
}

export default function ApprovalHistoryModal({ deal, onClose }) {
  return (
    <Modal title={deal ? `Approval history · ${deal.title}` : ''} open={Boolean(deal)} onClose={onClose} size="lg">
      {deal && <HistoryBody dealId={deal._id} />}
    </Modal>
  );
}
