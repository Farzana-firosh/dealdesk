// Maps backend status values to a colour, so every page shows statuses the same way.
const STATUS_TONE = {
  open: 'info',
  pending_approval: 'warning',
  won: 'success',
  pending: 'warning',
  approved: 'success',
  auto_approved: 'success',
  requested: 'info',
  rejected: 'danger',
  queued: 'default',
  retrying: 'warning',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'default',
  sent: 'info',
  viewed: 'primary',
  paid: 'success',
};

const label = (s) => String(s).replace(/_/g, ' ');

export default function Badge({ tone = 'default', dot, children }) {
  return <span className={`badge${tone !== 'default' ? ` badge-${tone}` : ''}${dot ? ' badge-dot' : ''}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'default'} dot>{label(status)}</Badge>;
}
