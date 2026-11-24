import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Icon, StatusBadge } from '../../components/common';
import { countOf, formatMoney, greeting, LOST_REASONS, roleLabel, SCOPE_TEXT } from '../../utils/format';
import MonthlyChart from './MonthlyChart';
import Ring from './Ring';
import { ApprovalsArt, ChatArt, DealsArt, InvoicesArt, NewDealArt } from './Illustrations';

const RECENT = 4;

// Everything the dashboard shows, fetched together; sections the role cannot see are skipped.
// Invoices: one row is enough, the numbers come from the list's summary over the whole scope.
async function loadDashboard(can) {
  const [summary, deals, pending, invoices] = await Promise.all([
    api.get('/analytics/deals'),
    api.get(`/deals?limit=${RECENT}`),
    can('discount.approve') ? api.get('/approvals/pending') : null,
    can('invoice.view') ? api.get('/invoices?limit=1') : null,
  ]);
  return { summary, deals: deals.deals, pending: pending?.requests ?? null, invoices: invoices?.summary ?? null };
}

// Three shortcuts beside the greeting, picked from what the role can do.
function quickActions(can, data, navigate) {
  return [
    can('deal.edit') && { Art: NewDealArt, title: 'New deal', text: 'Pick a customer and products', go: () => navigate('/deals', { state: { newDeal: true } }) },
    can('discount.approve') && { Art: ApprovalsArt, title: 'Approvals', text: data?.pending ? `${countOf(data.pending.length, 'request')} waiting on you` : 'Requests for your role', go: () => navigate('/approvals') },
    can('invoice.view') && { Art: InvoicesArt, title: 'Invoices', text: data?.invoices ? `${formatMoney(data.invoices.outstanding.amount)} outstanding` : 'Billing status', go: () => navigate('/invoices') },
    can('chat.send') && { Art: ChatArt, title: 'Deal chat', text: 'Talk to your team per deal', go: () => navigate('/chat') },
    { Art: DealsArt, title: 'All deals', text: 'Your pipeline at a glance', go: () => navigate('/deals') },
  ].filter(Boolean).slice(0, 3);
}

function Attention({ pending, invoices }) {
  const failed = invoices?.failedPush ?? 0;
  const open = invoices?.outstanding ?? { count: 0, amount: 0 };
  const rows = [];

  pending?.slice(0, 4).forEach((r) =>
    rows.push(
      <Link key={r._id} to="/approvals" className="mini-row">
        <span className="mini-mark warning" />
        <div className="grow">
          <div className="cell-title">{r.dealId?.title}</div>
          <div className="cell-sub">Step {r.currentStep} of {r.steps.length} · requested by {r.requestedBy?.name}</div>
        </div>
        <Badge tone="warning">{r.discountPercent}%</Badge>
      </Link>,
    ),
  );
  if (failed) {
    rows.push(
      <Link key="failed" to="/invoices" className="mini-row">
        <span className="mini-mark danger" />
        <div className="grow">
          <div className="cell-title">{countOf(failed, 'invoice')} failed to reach BillPort</div>
          <div className="cell-sub">Retry the push from the invoices page</div>
        </div>
      </Link>,
    );
  }
  if (open.count) {
    rows.push(
      <Link key="outstanding" to="/invoices" className="mini-row">
        <span className="mini-mark info" />
        <div className="grow">
          <div className="cell-title">{formatMoney(open.amount)} outstanding</div>
          <div className="cell-sub">{countOf(open.count, 'invoice')} sent and not yet paid</div>
        </div>
      </Link>,
    );
  }

  return (
    <Card title="Needs your attention" padded={false} className="bento-attention">
      {rows.length ? <div className="mini-list">{rows}</div> : (
        <EmptyState icon="check" title="You're all caught up">Nothing is waiting on you right now.</EmptyState>
      )}
    </Card>
  );
}

function LostReasons({ reasons, className = 'bento-reasons' }) {
  const max = Math.max(1, ...reasons.map((r) => r.count));
  return (
    <Card title="Why deals were lost" className={className}>
      {reasons.length ? (
        <div className="reason-list">
          {reasons.map((r) => (
            <div key={r.reason} className="reason-row">
              <div className="row">
                <span>{LOST_REASONS[r.reason]}</span>
                <span className="spacer" />
                <b>{r.count}</b>
              </div>
              <div className="reason-track"><div style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="chart" title="No lost deals">Reasons are recorded when a deal is marked lost.</EmptyState>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const { data, loading, reload } = useAsync(() => loadDashboard(can), [can]);
  useSocketEvent('notification', reload); // approvals and invoice updates change these numbers

  const firstName = user.name.split(' ')[0];
  const top = (
    <section className="bento-top">
      <div className="greeting">
        <span className="greeting-chip">{greeting()} · {roleLabel(user.role.name)}</span>
        <h2>Hi, {firstName}!</h2>
        <p>Where are your deals heading today?</p>
        {data && <span className="faint">{SCOPE_TEXT[data.summary.scope]}</span>}
      </div>
      {quickActions(can, data, navigate).map(({ Art, title, text, go }) => (
        <button key={title} type="button" className="card quick-card" onClick={go}>
          <span className="quick-art"><Art /></span>
          <b>{title}</b>
          <span>{text}</span>
        </button>
      ))}
    </section>
  );

  if (loading && !data) return <>{top}<Card><div className="empty">Loading…</div></Card></>;
  if (!data) return <>{top}<Card><EmptyState icon="info" title="Could not load the dashboard">Check your connection and refresh.</EmptyState></Card></>;

  const { summary, deals, pending, invoices } = data;
  const s = summary.byStatus;
  const sum = (key, field = 'count') => summary.months.reduce((n, m) => n + m[key][field], 0);
  const closed = sum('won') + sum('lost');
  const pipelineValue = s.open.value + s.pending_approval.value;
  const inApproval = pipelineValue ? Math.round((s.pending_approval.value / pipelineValue) * 100) : null;
  const hasAttention = Boolean(pending || invoices);

  return (
    <>
      {top}

      <section className="bento">
        {/* roles without approvals or invoices get the lost reasons in the attention slot */}
        {hasAttention ? <Attention pending={pending} invoices={invoices} /> : <LostReasons reasons={summary.lostReasons} className="bento-attention" />}

        <Card title="Won and lost per month" className="bento-chart">
          {closed ? <MonthlyChart months={summary.months} /> : (
            <EmptyState icon="chart" title="No closed deals yet">Deals appear here once they are won or marked lost.</EmptyState>
          )}
        </Card>

        <div className="bento-rings">
          <div className="card ring-card">
            <Ring value={summary.winRate} label="Win rate" color="var(--slate)" />
            <div>
              <div className="ring-title">Win rate</div>
              <div className="cell-sub">{closed ? `${sum('won')} won · ${sum('lost')} lost` : 'No deals closed yet'}</div>
              <div className="faint">Last 6 months</div>
            </div>
          </div>
          <div className="card ring-card">
            <Ring value={inApproval} label="Pipeline awaiting approval" color="var(--steel)" />
            <div>
              <div className="ring-title">In approval</div>
              <div className="cell-sub">{countOf(s.pending_approval.count, 'deal')} · {formatMoney(s.pending_approval.value)}</div>
              <div className="faint">Share of open pipeline</div>
            </div>
          </div>
        </div>

        <Card title="Recent deals" padded={false} className={`bento-recent${hasAttention ? '' : ' wide'}`}
          actions={<Link to="/deals" className="card-link">All deals <Icon name="arrowRight" size={14} /></Link>}>
          {deals.length ? (
            <div className="mini-list">
              {deals.slice(0, RECENT).map((d) => (
                <Link key={d._id} to={can('chat.send') ? `/chat/${d._id}` : '/deals'} className="mini-row">
                  <div className="grow">
                    <div className="cell-title">{d.title}</div>
                    <div className="cell-sub">{d.customerId?.name} · {d.ownerId?.name}</div>
                  </div>
                  <span className="mono">{formatMoney(d.total)}</span>
                  <StatusBadge status={d.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="deals" title="No deals yet">Create the first one from the deals page.</EmptyState>
          )}
        </Card>

        {hasAttention && <LostReasons reasons={summary.lostReasons} />}

        <div className="accent-card">
          <span className="accent-label">Open pipeline</span>
          <div className="accent-value">{formatMoney(pipelineValue)}</div>
          <div className="accent-sub">{countOf(s.open.count + s.pending_approval.count, 'deal')} open · {formatMoney(sum('won', 'value'))} won in 6 months</div>
          <Button onClick={() => navigate('/deals')}>View pipeline</Button>
          <svg className="accent-waves" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 40 Q37 26 75 40 T150 40 T225 40 T300 40 V80 H0Z" fill="rgba(184,208,222,.18)" />
            <path d="M0 56 Q37 44 75 56 T150 56 T225 56 T300 56 V80 H0Z" fill="rgba(184,208,222,.22)" />
          </svg>
        </div>
      </section>
    </>
  );
}
