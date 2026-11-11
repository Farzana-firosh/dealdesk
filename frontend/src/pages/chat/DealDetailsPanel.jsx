import { api } from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import { StatusBadge } from '../../components/common';
import ApprovalSteps from '../../components/ApprovalSteps';
import { formatDate, formatMoney } from '../../utils/format';

// Deal context next to the conversation. Uses the same scoped endpoints as the Deals page.
export default function DealDetailsPanel({ dealId }) {
  const { data, reload } = useAsync(async () => {
    const [{ deal }, approvals] = await Promise.all([api.get(`/deals/${dealId}`), api.get(`/deals/${dealId}/approvals`)]);
    return { deal, approvals };
  }, [dealId]);
  useSocketEvent('notification', reload);

  if (!data) return <aside className="chat-details" />;
  const { deal, approvals } = data;
  const latest = approvals.requests[0];

  return (
    <aside className="chat-details">
      <div className="card card-body">
        <div className="section-title">Deal details</div>
        <dl className="kv">
          <dt>Customer</dt><dd>{deal.customerId?.name}</dd>
          <dt>Owner</dt><dd>{deal.ownerId?.name}</dd>
          <dt>Branch</dt><dd>{deal.branchId?.name}</dd>
          <dt>Subtotal</dt><dd className="mono">{formatMoney(deal.subtotal)}</dd>
          <dt>Discount</dt><dd>{deal.discountPercent ? `${deal.discountPercent}%` : '–'}</dd>
          <dt>Total</dt><dd className="mono">{formatMoney(deal.total)}</dd>
          <dt>Status</dt><dd><StatusBadge status={deal.status} /></dd>
        </dl>
      </div>

      <div className="card card-body">
        <div className="section-title">Approval workflow</div>
        {latest ? (
          <>
            <div className="faint" style={{ marginBottom: 10 }}>{latest.discountPercent}% requested · {latest.status}</div>
            <ApprovalSteps request={latest} />
          </>
        ) : (
          <span className="muted">No discount requested.</span>
        )}
      </div>

      <div className="card card-body">
        <div className="section-title">Audit trail</div>
        {approvals.history.length === 0 && <span className="muted">Nothing yet.</span>}
        <div className="timeline">
          {approvals.history.slice(-6).reverse().map((h) => (
            <div key={h._id} className="timeline-item">
              <div>
                <div>{h.action.replace('_', ' ')}{h.step ? ` · step ${h.step}` : ''}</div>
                <span className="faint">{h.approverId?.name} · {formatDate(h.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
