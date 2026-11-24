const Role = require('./role.model');
const User = require('../users/user.model');
const ApprovalConfig = require('../approvals/approval-config.model');
const ApprovalRequest = require('../approvals/approval-request.model');
const AppError = require('../../common/errors/AppError');
const env = require('../../config/env');
const { grantsNotHeld } = require('../auth/scope');

// The roles the seed creates. They cannot be deleted, and in the public demo they are read-only,
// so one visitor cannot strip permissions and break the demo for the next.
const BUILT_IN_ROLES = ['sales_exec', 'sales_manager', 'finance', 'admin'];

// Always holds every permission. Together with "nobody edits their own role" and the users rules,
// this means someone can always manage users and roles.
const LOCKED_ROLE = 'admin';

// Why `actor` may not change `role`, or null when they may.
function editBlocker(actor, role) {
  if (env.demoMode && BUILT_IN_ROLES.includes(role.name)) {
    return 'Built-in roles are read-only in the demo. Create a new role to try out permissions.';
  }
  if (role.name === LOCKED_ROLE) return 'The admin role always has every permission and cannot be changed.';
  if (String(role._id) === String(actor.role._id)) return 'You cannot change your own role. Ask another administrator.';
  if (grantsNotHeld(actor, role.permissions).length) return 'This role has access you do not have. Ask an administrator with more access.';
  return null;
}

function assertCanEdit(actor, role) {
  const reason = editBlocker(actor, role);
  if (reason) throw AppError.forbidden(reason);
}

function assertCanGrant(actor, permissions) {
  const missing = grantsNotHeld(actor, permissions);
  if (missing.length) throw new AppError(403, 'You cannot give access that you do not have yourself.', { missing });
}

async function listRoles(actor) {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ name: 1 }).lean(),
    User.aggregate([{ $group: { _id: '$roleId', count: { $sum: 1 } } }]),
  ]);
  const userCount = new Map(counts.map((c) => [String(c._id), c.count]));
  return roles.map((r) => ({
    ...r,
    builtIn: BUILT_IN_ROLES.includes(r.name),
    userCount: userCount.get(String(r._id)) ?? 0,
    editable: editBlocker(actor, r) === null,
  }));
}

async function createRole(actor, data) {
  assertCanGrant(actor, data.permissions);
  // the unique index is the final guard if two requests race
  if (await Role.exists({ name: data.name })) throw AppError.conflict(`A role named "${data.name}" already exists`);
  return Role.create(data);
}

async function updateRole(actor, id, data) {
  const role = await Role.findById(id);
  if (!role) throw AppError.notFound('Role not found');
  assertCanEdit(actor, role);
  if (data.permissions) assertCanGrant(actor, data.permissions);

  Object.assign(role, data);
  return role.save();
}

// Only unused custom roles: deleting a role in use would leave users or approval chains without it.
async function deleteRole(actor, id) {
  const role = await Role.findById(id).lean();
  if (!role) throw AppError.notFound('Role not found');
  if (BUILT_IN_ROLES.includes(role.name)) throw AppError.forbidden('Built-in roles cannot be deleted.');
  assertCanEdit(actor, role);

  const [users, inRules, inRequests] = await Promise.all([
    User.countDocuments({ roleId: role._id }),
    ApprovalConfig.exists({ 'bands.steps': role._id }),
    ApprovalRequest.exists({ status: 'pending', 'steps.roleId': role._id }),
  ]);
  if (users) throw AppError.conflict(`${users} user${users === 1 ? ' has' : 's have'} this role. Give them another role first.`);
  if (inRules) throw AppError.conflict('The discount approval rules use this role. Remove it there first.');
  if (inRequests) throw AppError.conflict('An open discount request is waiting on this role. Try again once it is decided.');

  await Role.deleteOne({ _id: role._id });
}

module.exports = { BUILT_IN_ROLES, listRoles, createRole, updateRole, deleteRole };
