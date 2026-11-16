const Role = require('./role.model');
const AppError = require('../../common/errors/AppError');
const env = require('../../config/env');

// The roles the seed creates. In the public demo they are read-only, so one visitor cannot
// strip permissions and break the demo for the next; custom roles stay fully editable.
const BUILT_IN_ROLES = ['sales_exec', 'sales_manager', 'finance', 'admin'];

const listRoles = () => Role.find().sort({ name: 1 }).lean();

const createRole = (data) => Role.create(data);

async function updateRole(id, data) {
  if (env.demoMode) {
    const existing = await Role.findById(id, 'name').lean();
    if (existing && BUILT_IN_ROLES.includes(existing.name)) {
      throw AppError.forbidden('Built-in roles are read-only in the demo. Create a new role to try out permissions.');
    }
  }

  const role = await Role.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  if (!role) throw AppError.notFound('Role not found');
  return role;
}

module.exports = { BUILT_IN_ROLES, listRoles, createRole, updateRole };
