import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import { Button, Card, PageHeader, Pagination, Select, StatusBadge, Table } from '../../components/common';
import { formatDate, formatMoney, LOST_REASONS } from '../../utils/format';
import NewDealDrawer from './NewDealDrawer';
import DiscountModal from './DiscountModal';
import ApprovalHistoryDrawer from './ApprovalHistoryDrawer';
import LostDealModal from './LostDealModal';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function DealsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null); // { type, deal }

  // "New deal" from the dashboard lands here with state; open the form once and clear it
  useEffect(() => {
    if (location.state?.newDeal && can('deal.edit')) {
      setModal({ type: 'new' });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, can]);

  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAsync(
    () => api.get(`/deals?page=${page}&limit=${PAGE_SIZE}${status ? `&status=${status}` : ''}`),
    [status, page],
  );
  useSocketEvent('notification', reload); // approval decisions change deal status

  // the last page can empty out (e.g. a filtered deal changes status): step back to the new last page
  useEffect(() => {
    if (data && data.total && page > data.pages) setPage(data.pages);
  }, [data, page]);

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

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
    { key: 'owner', header: 'Owner', render: (d) => (<><div className="nowrap">{d.ownerId?.name}</div><div className="cell-sub">{d.branchId?.name}</div></>) },
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
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <>
          <StatusBadge status={d.status} />
          {d.status === 'lost' && <div className="cell-sub" title={d.lostNotes || undefined}>{LOST_REASONS[d.lostReason]}</div>}
        </>
      ),
    },
    { key: 'updated', header: 'Updated', render: (d) => <span className="muted nowrap">{formatDate(d.updatedAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <div className="cell-actions">
          {can('chat.send') && <Button size="sm" icon="chat" onClick={() => navigate(`/chat/${d._id}`)}>Chat</Button>}
          <Button size="sm" onClick={() => setModal({ type: 'history', deal: d })}>History</Button>
          {d.status === 'open' && can('deal.edit') && (
            <>
              <Button size="sm" variant="primary" onClick={() => setModal({ type: 'discount', deal: d })}>Request discount</Button>
              <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'lost', deal: d })}>Mark lost</Button>
            </>
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
      <PageHeader title="Deals">
        <div className="filter">
          <Select value={status} onChange={(e) => changeStatus(e.target.value)} placeholder="All statuses" options={STATUS_OPTIONS} />
        </div>
        <Button icon="refresh" onClick={reload} aria-label="Refresh" />
        {can('deal.edit') && <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>New deal</Button>}
      </PageHeader>

      <Card padded={false} className="card-fill">
        <Table columns={columns} rows={data?.deals} loading={loading && !data} empty="No deals in your scope" />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} noun="deal" onChange={setPage} />}
      </Card>

      <NewDealDrawer open={modal?.type === 'new'} onClose={close} onCreated={done} />
      <DiscountModal deal={modal?.type === 'discount' ? modal.deal : null} onClose={close} onDone={done} />
      <ApprovalHistoryDrawer deal={modal?.type === 'history' ? modal.deal : null} onClose={close} />
      <LostDealModal deal={modal?.type === 'lost' ? modal.deal : null} onClose={close} onDone={done} />
    </>
  );
}
