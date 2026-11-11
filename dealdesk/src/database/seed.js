// Resets the database to a known demo state. Usage: npm run seed
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const { PERMISSION_KEYS } = require('../modules/roles/permissions');
const { hashPassword } = require('../modules/auth/auth.service');
const Branch = require('../modules/branches/branch.model');
const Role = require('../modules/roles/role.model');
const User = require('../modules/users/user.model');
const Customer = require('../modules/customers/customer.model');
const Product = require('../modules/products/product.model');
const Deal = require('../modules/deals/deal.model');
const ApprovalConfig = require('../modules/approvals/approval-config.model');
const { ensureThread } = require('../modules/chat/chat.service');
require('./models'); // register the rest so syncIndexes covers every collection

const PASSWORD = 'Password123!';

const grant = (key, scope = 'own') => ({ key, scope });

const ROLES = [
  {
    name: 'sales_exec',
    description: 'Creates and edits own deals, requests discounts, chats',
    permissions: [grant('deal.view'), grant('deal.edit'), grant('invoice.view'), grant('chat.send')],
  },
  {
    name: 'sales_manager',
    description: 'Sales exec + sees every deal in own branch + approves discounts up to their limit',
    permissions: [
      grant('deal.view', 'branch'),
      grant('deal.edit'),
      grant('discount.approve', 'branch'),
      grant('invoice.view', 'branch'),
      grant('chat.send'),
    ],
  },
  {
    name: 'finance',
    description: 'Reads all deals, approves any discount, issues and cancels invoices',
    permissions: [
      grant('deal.view', 'all'),
      grant('discount.approve', 'all'),
      grant('invoice.view', 'all'),
      grant('invoice.issue', 'all'),
      grant('invoice.cancel', 'all'),
      grant('chat.send'),
    ],
  },
  {
    name: 'admin',
    description: 'Everything, plus roles and approval configuration',
    permissions: PERMISSION_KEYS.map((key) => grant(key, 'all')),
  },
];

async function seed() {
  await connectDb();
  await mongoose.connection.dropDatabase();
  // dropDatabase removes indexes too; rebuild them from the schemas
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  const [branchA, branchB] = await Branch.create([
    { name: 'Dubai', code: 'DXB' },
    { name: 'Abu Dhabi', code: 'AUH' },
  ]);

  const roles = await Role.create(ROLES);
  const roleId = Object.fromEntries(roles.map((r) => [r.name, r._id]));
  const passwordHash = await hashPassword(PASSWORD);

  // Discount approval bands: (min, max] -> ordered approver roles
  await ApprovalConfig.create({
    key: 'discount',
    bands: [
      { minPercent: 0, maxPercent: 10, steps: [] },
      { minPercent: 10, maxPercent: 25, steps: [roleId.sales_manager] },
      { minPercent: 25, maxPercent: 40, steps: [roleId.sales_manager, roleId.finance] },
      { minPercent: 40, maxPercent: 100, steps: [roleId.sales_manager, roleId.finance, roleId.admin] },
    ],
  });

  const user = (name, email, role, branch, manager = null) =>
    User.create({ name, email, passwordHash, roleId: roleId[role], branchId: branch._id, managerId: manager?._id ?? null });

  const managerA = await user('Omar Manager', 'manager.a@dealdesk.test', 'sales_manager', branchA);
  const managerB = await user('Sara Manager', 'manager.b@dealdesk.test', 'sales_manager', branchB);
  const execA = await user('Aisha Exec', 'exec.a@dealdesk.test', 'sales_exec', branchA, managerA);
  const execB = await user('Ravi Exec', 'exec.b@dealdesk.test', 'sales_exec', branchB, managerB);
  await user('Fatima Finance', 'finance@dealdesk.test', 'finance', branchA);
  await user('Adam Admin', 'admin@dealdesk.test', 'admin', branchA);

  const customers = await Customer.create([
    { name: 'Gulf Construction LLC', email: 'ap@gulfconstruction.test', branchId: branchA._id },
    { name: 'Desert Logistics', email: 'billing@desertlogistics.test', branchId: branchB._id },
    { name: 'Marina Facilities', email: 'finance@marinafacilities.test', branchId: branchA._id },
  ]);

  const products = await Product.create([
    { sku: 'EXC-200', name: 'Compact Excavator', price: 45000 },
    { sku: 'GEN-50', name: '50kVA Generator', price: 12000 },
    { sku: 'FLT-3T', name: '3 Ton Forklift', price: 28000 },
  ]);

  const item = (p, quantity) => ({ productId: p._id, name: p.name, unitPrice: p.price, quantity });
  const deal = (title, owner, customer, items) =>
    Deal.create({ title, ownerId: owner._id, branchId: owner.branchId, customerId: customer._id, items });

  const deals = [
    await deal('Excavator fleet – Gulf Construction', execA, customers[0], [item(products[0], 2)]),
    await deal('Generators – Marina Facilities', managerA, customers[2], [item(products[1], 3)]),
    await deal('Forklifts – Desert Logistics', execB, customers[1], [item(products[2], 4)]),
  ];
  for (const d of deals) await ensureThread(d._id);

  console.log(`[seed] done. All users have password: ${PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
