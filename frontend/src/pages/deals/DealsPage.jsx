import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import { Button, Card, Select, StatusBadge, Table } from '../../components/common';
import { formatDate, formatMoney } from '../../utils/format';
import NewDealModal from './NewDealModal';
import DiscountModal from './DiscountModal';
import ApprovalHistoryModal from './ApprovalHistoryModal';

const SCOPE_TEXT = { own: 'Showing deals you own', branch: 'Showing every deal in your branch', all: 'Showing deals across all branches' };

export default function DealsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null); // { type, deal }

  const { data, loading, reload } = useAsync(() => api.get(`/deals${status ? `?status=${status}` : ''}`), [status]);
  useSocketEvent('notification', reload); // approval decisions change deal status

  const convert = async (deal) => {
    try {
      const { invoice } = await api.post(`/deals/${deal._id}/convert`);
      toast.success(`Invoice ${invoice.number} created and queued for BillPort`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Deal',
      render: (d) => (
        <>
          <div className="cell-title">{d.title}</div>
          <div className="cell-sub">{d.customerId?.name}</div>
        </>
      ),
    },
    { key: 'owner', header: 'Owner', render: (d) => (<><div>{d.ownerId?.name}</div><div className="cell-sub">{d.branchId?.name}</div></>) },
    {
      key: 'total',
      header: 'Value',
      align: 'right',
      render: (d) => (
        <>
          <div className="mono">{formatMoney(d.total)}</div>
          {d.discountPercent > 0 && <div className="cell-sub">-{d.discountPercent}% of {formatMoney(d.subtotal)}</div>}
        </>
      ),
    },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'updated', header: 'Updated', render: (d) => <span className="muted">{formatDate(d.updatedAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <div className="cell-actions">
          {can('chat.send') && <Button size="sm" icon="chat" onClick={() => navigate(`/chat/${d._id}`)}>Chat</Button>}
          <Button size="sm" onClick={() => setModal({ type: 'history', deal: d })}>History</Button>
          {d.status === 'open' && can('deal.edit') && (
            <Button size="sm" variant="primary" onClick={() => setModal({ type: 'discount', deal: d })}>Request discount</Button>
          )}
          {d.status === 'won' && can('invoice.issue') && (
            <Button size="sm" variant="success" onClick={() => convert(d)}>Convert</Button>
          )}
        </div>
      ),
    },
  ];

  const close = () => setModal(null);
  const done = () => {
    close();
    reload();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Deals</h2>
          <p>{data ? SCOPE_TEXT[data.scope] : ' '}</p>
        </div>
        <span className="spacer" />
        <div style={{ width: 180 }}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses"
            options={[{ value: 'open', label: 'Open' }, { value: 'pending_approval', label: 'Pending approval' }, { value: 'won', label: 'Won' }]} />
        </div>
        <Button icon="refresh" onClick={reload} aria-label="Refresh" />
        {can('deal.edit') && <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>New deal</Button>}
      </div>

      <Card padded={false}>
        <Table columns={columns} rows={data?.deals} loading={loading && !data} empty="No deals in your scope" />
      </Card>

      <NewDealModal open={modal?.type === 'new'} onClose={close} onCreated={done} />
      <DiscountModal deal={modal?.type === 'discount' ? modal.deal : null} onClose={close} onDone={done} />
      <ApprovalHistoryModal deal={modal?.type === 'history' ? modal.deal : null} onClose={close} />
    </>
  );
}
