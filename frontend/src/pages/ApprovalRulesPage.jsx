import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { Badge, Button, Card, Input } from '../components/common';

// Admin editor for the approval bands. Steps are role names, comma separated, in order.
const toForm = (config) =>
  config.bands.map((b) => ({ minPercent: b.minPercent, maxPercent: b.maxPercent, steps: b.steps.map((s) => s.name).join(', ') }));

export default function ApprovalRulesPage() {
  const toast = useToast();
  const { data, reload } = useAsync(() => api.get('/approval-config'), []);
  const [bands, setBands] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setBands(toForm(data.config));
  }, [data]);

  const update = (i, key, value) => setBands((list) => list.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)));
  const remove = (i) => setBands((list) => list.filter((_, idx) => idx !== i));
  const add = () => setBands((list) => [...list, { minPercent: list.at(-1)?.maxPercent ?? 0, maxPercent: 100, steps: '' }]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/approval-config', {
        bands: bands.map((b) => ({
          minPercent: Number(b.minPercent),
          maxPercent: Number(b.maxPercent),
          steps: b.steps.split(',').map((s) => s.trim()).filter(Boolean),
        })),
      });
      toast.success('Approval rules saved – new requests use them immediately');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Discount approval rules</h2>
          <p>Each band covers discounts above “from” up to and including “to”. No steps means auto-approved.</p>
        </div>
        <span className="spacer" />
        {data && <Badge tone="primary">version {data.config.version}</Badge>}
      </div>

      <Card
        title="Bands"
        actions={
          <>
            <Button icon="plus" size="sm" onClick={add}>Add band</Button>
            <Button variant="primary" size="sm" onClick={save} loading={busy}>Save rules</Button>
          </>
        }
      >
        <div className="stack">
          {bands.map((b, i) => (
            <div key={i} className="band-row">
              <Input label="From %" type="number" value={b.minPercent} onChange={(e) => update(i, 'minPercent', e.target.value)} />
              <Input label="To %" type="number" value={b.maxPercent} onChange={(e) => update(i, 'maxPercent', e.target.value)} />
              <Input label="Approval steps (in order)" placeholder="auto-approved" value={b.steps}
                onChange={(e) => update(i, 'steps', e.target.value)} hint="e.g. sales_manager, finance, admin" />
              <Button variant="ghost" icon="x" onClick={() => remove(i)} aria-label="Remove band" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
