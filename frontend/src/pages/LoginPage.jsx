import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Icon, Input } from '../components/common';

const FEATURES = [
  { icon: 'shield', title: 'Access by role and branch', text: 'Everyone sees exactly the deals they are allowed to.' },
  { icon: 'layers', title: 'Configurable approvals', text: 'Discounts follow the approval chain your admin defines.' },
  { icon: 'zap', title: 'Invoices that stay in sync', text: 'Billing status updates itself after a deal is won.' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your work email.';
  else if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

// 401 gets a friendlier wording; 429 and "server unreachable" already carry a clear message.
const messageFor = (err) => (err.status === 401 ? 'Incorrect email or password.' : err.message);

/** Demo personas from the API (empty unless it runs in demo mode), plus a "waking up" flag. */
function useDemoAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let active = true;
    // free hosting sleeps when idle; this first request is what wakes the API up
    const timer = setTimeout(() => active && setWaking(true), 2500);
    api
      .get('/auth/demo')
      .then((res) => active && setAccounts(res.accounts))
      .catch(() => {}) // no demo buttons; the normal form still works
      .finally(() => {
        clearTimeout(timer);
        if (active) setWaking(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return { accounts, waking };
}

export default function LoginPage() {
  const { user, login, demoLogin } = useAuth();
  const { accounts, waking } = useDemoAccounts();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // 'form' | demo account key | null

  if (user) return <Navigate to="/deals" replace />;

  const run = async (what, action) => {
    setError('');
    setBusy(what);
    try {
      await action();
    } catch (err) {
      setError(messageFor(err));
      setBusy(null);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) run('form', () => login(email.trim(), password));
  };

  return (
    <div className="login">
      <aside className="login-aside">
        <div className="brand">
          <span className="brand-mark">D</span>
          DealDesk
        </div>
        <h1>
          Every deal and every conversation, <span>in one place.</span>
        </h1>
        <p>Create deals, route discounts for approval, discuss them with your team in real time, and track invoices through to payment.</p>
        <div className="feature-list">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="feature-icon"><Icon name={f.icon} size={17} /></span>
              <div>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="login-aside-footer">© {new Date().getFullYear()} DealDesk</div>
      </aside>

      <main className="login-main">
        <div className="login-panel stack">
          <div className="brand login-brand-mobile">
            <span className="brand-mark">D</span>
            DealDesk
          </div>

          <form className="stack" onSubmit={submit} noValidate>
            <div>
              <h2>Welcome back</h2>
              <span className="muted">Sign in to continue to your workspace.</span>
            </div>

            {error && <div className="form-alert" role="alert"><Icon name="info" size={16} />{error}</div>}
            {waking && !error && (
              <div className="form-note" role="status">Waking up the server – this can take up to a minute on free hosting.</div>
            )}

            <Input label="Work email" icon="mail" type="email" autoComplete="username" placeholder="name@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} disabled={Boolean(busy)} />
            <Input label="Password" icon="lock" type="password" autoComplete="current-password" placeholder="Your password"
              value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} disabled={Boolean(busy)} />

            <Button type="submit" variant="primary" size="lg" block iconRight="arrowRight" loading={busy === 'form'} disabled={Boolean(busy)}>
              Sign in
            </Button>
          </form>

          {accounts.length > 0 && (
            <section className="stack demo-section" aria-labelledby="demo-heading">
              <div className="divider"><span id="demo-heading">or explore the live demo</span></div>
              <div className="demo-grid">
                {accounts.map((a) => (
                  <button key={a.key} type="button" className="demo-card" disabled={Boolean(busy)}
                    onClick={() => run(a.key, () => demoLogin(a.key))}>
                    <b>{busy === a.key ? 'Signing in…' : a.label}</b>
                    <span>{a.description}</span>
                  </button>
                ))}
              </div>
              <p className="faint">Fictional, shared demo data. Each role sees different deals and actions.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
