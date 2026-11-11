const Role = require('./role.model');
const AppError = require('../../common/errors/AppError');

const listRoles = () => Role.find().sort({ name: 1 }).lean();

const createRole = (data) => Role.create(data);

async function updateRole(id, data) {
  const role = await Role.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  if (!role) throw AppError.notFound('Role not found');
  return role;
}

module.exports = { listRoles, createRole, updateRole };
