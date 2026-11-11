import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Modal, TextArea } from '../../components/common';
import { formatMoney } from '../../utils/format';

export default function DiscountModal({ deal, onClose, onDone }) {
  const toast = useToast();
  const [percent, setPercent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPercent('');
    setRemarks('');
  }, [deal]);

  const pct = Number(percent);
  const valid = percent !== '' && pct >= 0 && pct <= 100;

  const submit = async () => {
    setBusy(true);
    try {
      const { request } = await api.post(`/deals/${deal._id}/discount-request`, { discountPercent: pct, remarks });
      const chain = request.steps.map((s) => s.roleName.replace('_', ' ')).join(' → ');
      toast.success(request.steps.length ? `Sent for approval: ${chain}` : 'Within the auto-approval limit – deal won');
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Request discount"
      open={Boolean(deal)}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!valid}>Submit request</Button>
        </>
      }
    >
      {deal && (
        <div className="stack">
          <div className="muted">{deal.title} · {formatMoney(deal.subtotal)}</div>
          <Input label="Discount %" type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)}
            hint="The approval chain is chosen from the current approval rules." autoFocus />
          {valid && (
            <div className="row muted">
              New total <span className="spacer" /> <b className="mono">{formatMoney(deal.subtotal * (1 - pct / 100))}</b>
            </div>
          )}
          <TextArea label="Remarks" placeholder="Why does this customer need the discount?" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
