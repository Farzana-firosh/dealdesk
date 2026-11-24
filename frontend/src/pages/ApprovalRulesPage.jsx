import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { Badge, Button, Card, Icon, Input, PageHeader, Select } from '../components/common';
import { roleLabel } from '../utils/format';

// Admin editor for the discount approval bands. Each band is (from, to] with an ordered list of
// approver roles; a band with no steps is auto-approved. The checks below mirror the API, so
// mistakes show before saving and the server error is only a backstop.

let nextKey = 0;
const toBand = (minPercent, maxPercent, steps = []) => ({ key: nextKey++, minPercent, maxPercent, steps });
const toForm = (config) => config.bands.map((b) => toBand(b.minPercent, b.maxPercent, b.steps.map((s) => s.name)));

const isPercent = (v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

// Returns an error per band (by key) and page-level problems: gaps, overlaps, 0 and 100 ends.
function check(bands) {
  const rowErrors = {};
  const problems = [];
  if (!bands.length) return { rowErrors, problems: ['Add at least one band.'] };

  bands.forEach((b) => {
    if (!isPercent(b.minPercent) || !isPercent(b.maxPercent)) rowErrors[b.key] = 'Use a number from 0 to 100';
    else if (Number(b.maxPercent) <= Number(b.minPercent)) rowErrors[b.key] = '“To” must be above “From”';
  });
  if (Object.keys(rowErrors).length) return { rowErrors, problems };

  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  if (Number(sorted[0].minPercent) !== 0) problems.push(`Nothing covers 0–${sorted[0].minPercent}%. The first band must start at 0.`);
  sorted.slice(1).forEach((b, i) => {
    const prevMax = Number(sorted[i].maxPercent);
    const min = Number(b.minPercent);
    if (min > prevMax) problems.push(`Gap: nothing covers ${prevMax}–${min}%.`);
    if (min < prevMax) problems.push(`Overlap: ${min}–${Math.min(prevMax, Number(b.maxPercent))}% is in two bands.`);
  });
  const lastMax = Math.max(...sorted.map((b) => Number(b.maxPercent)));
  if (lastMax !== 100) problems.push(`Nothing covers ${lastMax}–100%. The last band must end at 100.`);
  return { rowErrors, problems };
}

// 0–100% strip: one coloured segment per band, with gaps showing through as hatching.
function BandBar({ bands, rowErrors }) {
  return (
    <div className="band-bar-wrap">
      <div className="band-bar" role="img" aria-label="Discount bands from 0 to 100 percent">
        {bands.map((b, i) => {
          if (rowErrors[b.key]) return null;
          const min = Number(b.minPercent);
          const width = Number(b.maxPercent) - min;
          return (
            <div key={b.key} className={`band-seg band-tone-${i % 5}`} style={{ left: `${min}%`, width: `${width}%` }}
              title={`${min}–${b.maxPercent}%: ${b.steps.length ? b.steps.map(roleLabel).join(' → ') : 'auto-approved'}`}>
              {width >= 8 && <span>{b.steps.length ? countSteps(b.steps.length) : 'Auto'}</span>}
            </div>
          );
        })}
      </div>
      <div className="band-ticks">
        {[0, 25, 50, 75, 100].map((t) => <span key={t} style={{ left: `${t}%` }}>{t}%</span>)}
      </div>
    </div>
  );
}

const countSteps = (n) => `${n} step${n === 1 ? '' : 's'}`;

// Ordered approver chips plus a picker that only offers real roles not already in the chain.
function StepPicker({ steps, roles, onChange }) {
  const available = roles.filter((r) => !steps.includes(r));
  return (
    <div className="field">
      <span className="field-label">Approval steps (in order)</span>
      <div className="step-chips">
        {steps.length === 0 && <Badge tone="success">Auto-approved</Badge>}
        {steps.map((name, i) => (
          <span key={name} className="step-chip">
            <span className="step-chip-no">{i + 1}</span>
            {roleLabel(name)}
            <button type="button" aria-label={`Remove ${roleLabel(name)}`} onClick={() => onChange(steps.filter((s) => s !== name))}>
              <Icon name="x" size={13} />
            </button>
          </span>
        ))}
        {/* Always shown, so a missing role list reads as a reason rather than a vanished control */}
        <div className="step-add">
          <Select placeholder={available.length ? '+ Add approver' : roles.length ? 'All roles added' : 'No roles found'}
            value="" disabled={!available.length}
            options={available.map((r) => ({ value: r, label: roleLabel(r) }))}
            onChange={(e) => e.target.value && onChange([...steps, e.target.value])} />
        </div>
      </div>
    </div>
  );
}

export default function ApprovalRulesPage() {
  const toast = useToast();
  const { data, reload } = useAsync(() => api.get('/approval-config'), []);
  const [bands, setBands] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setBands(toForm(data.config));
  }, [data]);

  const update = (key, field, value) => setBands((list) => list.map((b) => (b.key === key ? { ...b, [field]: value } : b)));
  const remove = (key) => setBands((list) => list.filter((b) => b.key !== key));

  // Fill whatever the last band leaves uncovered, or split the last band in half when it already ends at 100.
  const add = () => setBands((list) => {
    const last = list.at(-1);
    if (!last) return [toBand(0, 100)];
    const lastMax = Number(last.maxPercent);
    if (lastMax < 100) return [...list, toBand(lastMax, 100)];
    const mid = Math.round((Number(last.minPercent) + lastMax) / 2);
    return [...list.slice(0, -1), { ...last, maxPercent: mid }, toBand(mid, lastMax)];
  });

  const { rowErrors, problems } = check(bands);
  const valid = !problems.length && !Object.keys(rowErrors).length;

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/approval-config', {
        bands: bands.map((b) => ({ minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent), steps: b.steps })),
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
      <PageHeader title="Approval rules">
        {data && <Badge tone="primary">version {data.config.version}</Badge>}
        <Button icon="plus" onClick={add}>Add band</Button>
        <Button variant="primary" onClick={save} loading={busy} disabled={!valid}>Save rules</Button>
      </PageHeader>

      <Card title="Discount bands">
        <div className="stack">
          <div className="faint">Each band covers discounts above “from” up to and including “to” (the first band also includes 0%). Bands must run from 0 to 100% with no gaps or overlaps.</div>
          <BandBar bands={bands} rowErrors={rowErrors} />

          {problems.length > 0 && (
            <div className="form-alert" role="alert">
              <Icon name="info" size={16} />
              <div>{problems.map((p) => <div key={p}>{p}</div>)}</div>
            </div>
          )}

          {bands.map((b, i) => (
            <div key={b.key} className="band-row">
              <span className={`band-swatch band-tone-${i % 5}`}>{i + 1}</span>
              <Input label="From %" type="number" min={0} max={100} value={b.minPercent}
                aria-invalid={rowErrors[b.key] ? true : undefined} onChange={(e) => update(b.key, 'minPercent', e.target.value)} />
              <Input label="To %" type="number" min={0} max={100} value={b.maxPercent}
                aria-invalid={rowErrors[b.key] ? true : undefined} onChange={(e) => update(b.key, 'maxPercent', e.target.value)} />
              <StepPicker steps={b.steps} roles={data?.roles ?? []} onChange={(steps) => update(b.key, 'steps', steps)} />
              <Button variant="ghost" icon="x" onClick={() => remove(b.key)} aria-label={`Remove band ${i + 1}`} />
              {rowErrors[b.key] && <span className="field-error band-row-error">{rowErrors[b.key]}</span>}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
