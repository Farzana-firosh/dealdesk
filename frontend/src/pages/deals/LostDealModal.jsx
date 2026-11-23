import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Select, TextArea } from '../../components/common';
import { formatMoney, LOST_REASONS } from '../../utils/format';

const OPTIONS = Object.entries(LOST_REASONS).map(([value, label]) => ({ value, label }));

/** Closes an open deal as lost. The reason is required so it can be counted in analytics. */
export default function LostDealModal({ deal, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReason('');
    setNotes('');
  }, [deal]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/deals/${deal._id}/lost`, { reason, notes: notes.trim() });
      toast.success('Deal marked as lost');
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Mark deal as lost"
      open={Boolean(deal)}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason}>Mark as lost</Button>
        </>
      }
    >
      {deal && (
        <div className="stack">
          <div className="muted">{deal.title} · {formatMoney(deal.total)}</div>
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={OPTIONS} placeholder="Choose a reason" />
          <TextArea label="Notes (optional)" placeholder="Anything the team should know" value={notes} maxLength={500}
            onChange={(e) => setNotes(e.target.value)} />
          <div className="form-note">A lost deal is final: it can no longer be edited, discounted or invoiced.</div>
        </div>
      )}
    </Modal>
  );
}
