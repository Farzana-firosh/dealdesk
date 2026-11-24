// One-click demo personas. Only `key`, `label` and `description` are ever sent to the browser;
// the server maps the key to a seeded account, so no email or password ships with the UI.
const DEMO_ACCOUNTS = [
  { key: 'exec', email: 'exec.a@dealdesk.test', label: 'Sales executive', description: 'Dubai · sees own deals, requests discounts' },
  { key: 'manager', email: 'manager.a@dealdesk.test', label: 'Sales manager', description: 'Dubai · sees the branch, approves discounts' },
  { key: 'finance', email: 'finance@dealdesk.test', label: 'Finance', description: 'All branches · approves, issues invoices' },
  { key: 'admin', email: 'admin@dealdesk.test', label: 'Admin', description: 'Everything, plus roles and approval rules' },
];

const DEMO_KEYS = DEMO_ACCOUNTS.map((a) => a.key);

const publicDemoAccounts = () => DEMO_ACCOUNTS.map(({ key, label, description }) => ({ key, label, description }));

const demoEmailFor = (key) => DEMO_ACCOUNTS.find((a) => a.key === key)?.email;

// Every account the seed creates. Read-only in the demo so they keep working for the next visitor.
const SEEDED_EMAILS = [
  'exec.a@dealdesk.test',
  'manager.a@dealdesk.test',
  'exec.b@dealdesk.test',
  'manager.b@dealdesk.test',
  'finance@dealdesk.test',
  'admin@dealdesk.test',
];

const isSeededAccount = (email) => SEEDED_EMAILS.includes(email);

module.exports = { DEMO_KEYS, SEEDED_EMAILS, publicDemoAccounts, demoEmailFor, isSeededAccount };
