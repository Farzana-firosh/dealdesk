// One list of pages: the sidebar, the top bar title and the "where do I land" rule all read it,
// filtered by permission to mirror what the API allows.
export const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'chart', permission: 'deal.view' },
      { to: '/deals', label: 'Deals', icon: 'deals', permission: 'deal.view' },
      { to: '/chat', label: 'Deal chat', icon: 'chat', permission: 'chat.send', badge: 'unread' },
      { to: '/approvals', label: 'Approvals', icon: 'approvals', permission: 'discount.approve', badge: 'pending' },
      { to: '/invoices', label: 'Invoices', icon: 'invoices', permission: 'invoice.view' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings/users', label: 'Users', icon: 'users', permission: 'user.manage' },
      { to: '/settings/roles', label: 'Roles', icon: 'shield', permission: 'role.manage' },
      { to: '/settings/approvals', label: 'Approval rules', icon: 'settings', permission: 'approval_config.manage' },
      { to: '/settings/integrations', label: 'Integration health', icon: 'zap', permission: 'integration.view' },
    ],
  },
];

const ALL = NAV_SECTIONS.flatMap((s) => s.items);

// The first page the user may open. A role with no permissions lands on a page that says so.
export const homePath = (can) => ALL.find((item) => can(item.permission))?.to ?? '/no-access';
