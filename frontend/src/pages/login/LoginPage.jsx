import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { homePath } from '../../components/layout/nav';
import { Button, Icon, Input } from '../../components/common';
import ShipScene from './ShipScene';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEPART_MS = 1200; // matches the ship's sail-away animation

function validate(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your work email.';
  else if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

// 401 gets a friendlier wording; 429 and "server unreachable" already carry a clear message.
const messageFor = (err) => (err.status === 401 ? 'Incorrect email or password.' : err.message);

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
  const { user, can, login, demoLogin } = useAuth();
  const { accounts, waking } = useDemoAccounts();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // 'form' | demo account key | null
  // 'idle' → 'signing-in' (holds the redirect) → 'departing' (ship sails) → 'idle' (redirect happens)
  const [phase, setPhase] = useState('idle');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // already signed in (or the voyage finished): go to the first page this role may open
  if (user && phase === 'idle') return <Navigate to={homePath(can)} replace />;

  const run = async (what, action) => {
    setError('');
    setBusy(what);
    setPhase('signing-in');
    try {
      await action();
      setPhase('departing');
      timer.current = setTimeout(() => setPhase('idle'), prefersReducedMotion() ? 0 : DEPART_MS);
    } catch (err) {
      setError(messageFor(err));
      setBusy(null);
      setPhase('idle');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) run('form', () => login(email.trim(), password));
  };

  const departing = phase === 'departing';

  return (
    <div className="login">
      <span className="planet planet-big" aria-hidden="true" />
      <span className="planet planet-small" aria-hidden="true" />

      <div className={`login-card${departing ? ' is-departing' : ''}`}>
        {/* the scene sits in organic shapes over the right of the card (clip paths below) */}
        <div className="login-art" aria-hidden="true">
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <clipPath id="blob-back" clipPathUnits="objectBoundingBox">
              <path d="M0.2 0 C0.06 0.12 0.2 0.24 0.08 0.36 C0 0.47 0 0.6 0.07 0.7 C0.15 0.8 0.02 0.9 0.08 1 L1 1 L1 0 Z" />
            </clipPath>
            <clipPath id="blob-front" clipPathUnits="objectBoundingBox">
              <path d="M0.32 0 C0.16 0.1 0.31 0.22 0.19 0.34 C0.07 0.46 0.04 0.57 0.15 0.67 C0.27 0.77 0.07 0.87 0.17 1 L1 1 L1 0 Z" />
            </clipPath>
          </svg>
          <div className="art-back" />
          <div className="art-front"><ShipScene departing={departing} /></div>
        </div>

        <header className="login-top">
          <div className="brand">
            <span className="brand-mark">D</span>
            <span className="brand-name">DealDesk</span>
          </div>
        </header>

        <section className="login-form-side">
          <div className="login-form-wrap stack">
            <form className="stack" onSubmit={submit} noValidate>
              <div className="login-title">
                <span className="ghost" aria-hidden="true">DealDesk</span>
                <span className="eyebrow">Sign in to</span>
                <h1>Welcome aboard</h1>
                <span className="title-rule" />
                <p className="muted">Deals, approvals and invoices – set them in motion.</p>
              </div>

              {error && <div className="form-alert" role="alert"><Icon name="info" size={16} />{error}</div>}
              {waking && !error && (
                <div className="form-note" role="status">Waking up the server – this can take up to a minute on free hosting.</div>
              )}
              {departing && <div className="form-note" role="status"><Icon name="check" size={16} />Signed in – setting sail…</div>}

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
                      <span className="demo-text">
                        <b>{busy === a.key ? 'Signing in…' : a.label}</b>
                        <span className="demo-desc">{a.description}</span>
                      </span>
                      <Icon name="arrowRight" size={15} />
                    </button>
                  ))}
                </div>
                <p className="faint">Fictional, shared demo data. Each role sees different deals and actions.</p>
              </section>
            )}
          </div>

          <div className="faint">© {new Date().getFullYear()} DealDesk · every deal, safely to port</div>
        </section>
      </div>
    </div>
  );
}
