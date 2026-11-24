const User = require('./user.model');
const Role = require('../roles/role.model');
const Branch = require('../branches/branch.model');
const AppError = require('../../common/errors/AppError');
const env = require('../../config/env');
const { publish, EVENTS } = require('../../common/events');
const { scopeFilter, grantsNotHeld } = require('../auth/scope');
const { hashPassword } = require('../auth/auth.service');
const { isSeededAccount } = require('../auth/demo');

// Access rules:
//  - you see and edit only users inside your user.manage scope (own = yourself, branch, all)
//  - no escalation: you can only give a role whose access you hold yourself, and only manage
//    someone whose current access you hold
//  - no self-service access changes, so nobody can promote or lock out themselves
// Together they mean the last person who can manage everyone can never be removed by someone else.

const POPULATE = [
  { path: 'roleId', select: 'name' },
  { path: 'branchId', select: 'name code' },
  { path: 'managerId', select: 'name' },
];

// Fields you cannot change on your own account.
const ACCESS_FIELDS = ['roleId', 'branchId', 'managerId', 'active', 'password'];

const inScope = (actor, scope) => scopeFilter(actor, scope, { ownerField: '_id' });

function toView(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: { _id: user.roleId._id, name: user.roleId.name },
    branch: { _id: user.branchId._id, name: user.branchId.name, code: user.branchId.code },
    manager: user.managerId ? { _id: user.managerId._id, name: user.managerId.name } : null,
    active: user.active,
    readOnly: env.demoMode && isSeededAccount(user.email),
    createdAt: user.createdAt,
  };
}

async function getUser(id) {
  return toView(await User.findById(id).populate(POPULATE).lean());
}

async function listUsers(actor, scope) {
  const users = await User.find(inScope(actor, scope)).populate(POPULATE).sort({ name: 1 }).lean();
  return users.map(toView);
}

// Choices for the user form: every role (flagged when the caller may assign it), the branches
// they may use, and the active users who can be picked as a manager.
async function formOptions(actor, scope) {
  const [roles, branches, managers] = await Promise.all([
    Role.find({}, 'name description permissions').sort({ name: 1 }).lean(),
    Branch.find(scope === 'all' ? {} : { _id: actor.branchId }, 'name code').sort({ name: 1 }).lean(),
    User.find({ ...inScope(actor, scope), active: true }, 'name branchId').sort({ name: 1 }).lean(),
  ]);
  return {
    roles: roles.map((r) => ({
      _id: r._id,
      name: r.name,
      description: r.description,
      assignable: grantsNotHeld(actor, r.permissions).length === 0,
    })),
    branches,
    managers,
  };
}

async function assertAssignableRole(actor, roleId) {
  const role = await Role.findById(roleId, 'permissions').lean();
  if (!role) throw AppError.badRequest('Unknown role');
  const missing = grantsNotHeld(actor, role.permissions);
  if (missing.length) throw new AppError(403, 'You cannot give a role with access you do not have yourself.', { missing });
}

async function assertBranchAllowed(actor, scope, branchId) {
  if (scope !== 'all' && String(branchId) !== String(actor.branchId)) {
    throw AppError.forbidden('You can only place users in your own branch.');
  }
  if (!(await Branch.exists({ _id: branchId }))) throw AppError.badRequest('Unknown branch');
}

// A manager must be an active user in the same branch (deal chats include the owner's manager).
async function assertValidManager(managerId, branchId, userId) {
  if (!managerId) return;
  if (userId && String(managerId) === String(userId)) throw AppError.badRequest('A user cannot be their own manager');
  if (!(await User.exists({ _id: managerId, branchId, active: true }))) {
    throw AppError.badRequest('The manager must be an active user in the same branch');
  }
}

async function createUser(actor, scope, { password, ...data }) {
  if (scope === 'own') throw AppError.forbidden('You can only manage your own account.');
  await assertAssignableRole(actor, data.roleId);
  await assertBranchAllowed(actor, scope, data.branchId);
  await assertValidManager(data.managerId, data.branchId);
  // the unique index is the final guard if two requests race
  if (await User.exists({ email: data.email })) throw AppError.conflict('A user with this email already exists');

  const user = await User.create({ ...data, passwordHash: await hashPassword(password) });
  return getUser(user._id);
}

async function updateUser(actor, scope, id, changes) {
  const user = await User.findOne({ _id: id, ...inScope(actor, scope) }).populate('roleId', 'permissions');
  if (!user) throw AppError.notFound('User not found');

  if (env.demoMode && isSeededAccount(user.email)) {
    throw AppError.forbidden('The seeded demo accounts are read-only. Add a new user to try this out.');
  }
  const self = user._id.equals(actor._id);
  if (self && ACCESS_FIELDS.some((f) => f in changes)) {
    throw AppError.forbidden('You cannot change your own access, status or password here. Ask another administrator.');
  }
  if (!self) {
    const missing = grantsNotHeld(actor, user.roleId.permissions);
    if (missing.length) throw new AppError(403, 'This user has access you do not have. Ask an administrator with more access.', { missing });
  }

  if (changes.roleId) await assertAssignableRole(actor, changes.roleId);
  if (changes.branchId) await assertBranchAllowed(actor, scope, changes.branchId);
  if (changes.branchId || 'managerId' in changes) {
    const managerId = 'managerId' in changes ? changes.managerId : user.managerId;
    await assertValidManager(managerId, changes.branchId ?? user.branchId, user._id);
  }

  const { password, ...fields } = changes;
  Object.assign(user, fields);
  if (password) user.passwordHash = await hashPassword(password);
  await user.save();

  if (changes.active === false) publish(EVENTS.USER_DEACTIVATED, { userId: user._id });
  return getUser(user._id);
}

module.exports = { listUsers, formOptions, createUser, updateUser };
