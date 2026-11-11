import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Modal, Select } from '../../components/common';
import { formatMoney } from '../../utils/format';

const EMPTY = { title: '', customerId: '', productId: '', quantity: 1 };

export default function NewDealModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [refs, setRefs] = useState({ customers: [], products: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    Promise.all([api.get('/customers'), api.get('/products')]).then(([c, p]) => setRefs({ customers: c.customers, products: p.products }));
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const product = refs.products.find((p) => p._id === form.productId);
  const valid = form.title.trim() && form.customerId && form.productId && Number(form.quantity) > 0;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/deals', {
        title: form.title,
        customerId: form.customerId,
        items: [{ productId: form.productId, quantity: Number(form.quantity) }],
      });
      toast.success('Deal created');
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New deal"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!valid}>Create deal</Button>
        </>
      }
    >
      <div className="stack">
        <Input label="Title" placeholder="e.g. Excavators for Q3 site" value={form.title} onChange={set('title')} autoFocus />
        <Select label="Customer" placeholder="Select a customer" value={form.customerId} onChange={set('customerId')}
          options={refs.customers.map((c) => ({ value: c._id, label: c.name }))} />
        <div className="grid-2">
          <Select label="Product" placeholder="Select a product" value={form.productId} onChange={set('productId')}
            options={refs.products.map((p) => ({ value: p._id, label: `${p.name} · ${formatMoney(p.price)}` }))} />
          <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={set('quantity')} />
        </div>
        {product && (
          <div className="row muted">
            Deal value <span className="spacer" /> <b className="mono">{formatMoney(product.price * Number(form.quantity || 0))}</b>
          </div>
        )}
      </div>
    </Modal>
  );
}
