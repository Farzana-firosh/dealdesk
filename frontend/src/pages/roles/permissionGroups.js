// How the roles screen groups and names permission keys. The keys and their descriptions come
// from GET /roles/permissions; a key the API adds later lands in "Other" until it is placed here.
export const GROUPS = [
  { id: 'deals', label: 'Deals', icon: 'deals', keys: ['deal.view', 'deal.edit'] },
  { id: 'approvals', label: 'Approvals', icon: 'approvals', keys: ['discount.approve', 'approval_config.manage'] },
  { id: 'invoices', label: 'Invoices', icon: 'invoices', keys: ['invoice.view', 'invoice.issue', 'invoice.cancel', 'integration.view'] },
  { id: 'chat', label: 'Chat', icon: 'chat', keys: ['chat.send'] },
  { id: 'admin', label: 'Administration', icon: 'shield', keys: ['user.manage', 'role.manage'] },
];

export const NAMES = {
  'deal.view': 'View deals',
  'deal.edit': 'Create and edit deals',
  'discount.approve': 'Approve discounts',
  'approval_config.manage': 'Edit approval rules',
  'invoice.view': 'View invoices',
  'invoice.issue': 'Issue invoices',
  'invoice.cancel': 'Cancel invoices',
  'integration.view': 'Integration health',
  'chat.send': 'Deal chat',
  'user.manage': 'Manage users',
  'role.manage': 'Manage roles',
};

/** The catalogue's keys arranged into GROUPS, plus an "Other" group for anything unplaced. */
export function groupKeys(catalogKeys) {
  const placed = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => catalogKeys.includes(k)) })).filter((g) => g.keys.length);
  const other = catalogKeys.filter((k) => !placed.has(k));
  return other.length ? [...groups, { id: 'other', label: 'Other', icon: 'layers', keys: other }] : groups;
}
