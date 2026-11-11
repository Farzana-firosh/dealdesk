import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Icon, Input } from '../components/common';

const DEMO_USERS = [
  { email: 'exec.a@dealdesk.test', label: 'Sales exec · Dubai' },
  { email: 'manager.a@dealdesk.test', label: 'Manager · Dubai' },
  { email: 'exec.b@dealdesk.test', label: 'Sales exec · Abu Dhabi' },
  { email: 'manager.b@dealdesk.test', label: 'Manager · Abu Dhabi' },
  { email: 'finance@dealdesk.test', label: 'Finance' },
  { email: 'admin@dealdesk.test', label: 'Admin' },
];

const FEATURES = [
  { icon: 'shield', title: 'Access by role and branch', text: 'Everyone sees exactly the deals they are allowed to.' },
  { icon: 'layers', title: 'Configurable approvals', text: 'Discounts follow the approval chain your admin defines.' },
  { icon: 'zap', title: 'Invoices that stay in sync', text: 'Billing status updates itself after a deal is won.' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/deals" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.status === 400 ? 'Enter a valid email and password.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError('');
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
        <form className="login-form stack" onSubmit={submit} noValidate>
          <div>
            <h2>Welcome back</h2>
            <span className="muted">Sign in to continue to your workspace.</span>
          </div>

          <Input label="Work email" icon="mail" type="email" autoComplete="username" placeholder="name@company.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" icon="lock" type="password" autoComplete="current-password" placeholder="Your password"
            value={password} onChange={(e) => setPassword(e.target.value)} required error={error} />

          <Button type="submit" variant="primary" size="lg" block iconRight="arrowRight" loading={busy} disabled={!email || !password}>
            Sign in
          </Button>

          <div>
            <span className="faint">Demo accounts (password Password123!)</span>
            <div className="demo-users">
              {DEMO_USERS.map((u) => (
                <button key={u.email} type="button" className={`chip${email === u.email ? ' active' : ''}`} onClick={() => pickDemo(u.email)}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
