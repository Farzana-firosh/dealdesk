// Permission keys are referenced by code, so they live here.
// Roles (which permissions + which scope) are data in the `roles` collection.
const PERMISSIONS = {
  'deal.view': 'View deals',
  'deal.edit': 'Create and edit deals, request discounts',
  'discount.approve': 'Approve or reject approval steps addressed to your role',
  'invoice.view': 'View invoices and their integration logs',
  'invoice.issue': 'Convert won deals into sales and invoices',
  'invoice.cancel': 'Cancel invoices',
  'chat.send': 'Read and send messages in deal threads',
  'role.manage': 'Manage roles and their permissions',
  'approval_config.manage': 'Manage the discount approval configuration',
};

const PERMISSION_KEYS = Object.keys(PERMISSIONS);

// own: records the user owns · branch: user's branch · all: everything
const SCOPES = ['own', 'branch', 'all'];

module.exports = { PERMISSIONS, PERMISSION_KEYS, SCOPES };
