const roleService = require('./role.service');
const { PERMISSIONS, SCOPES } = require('./permissions');

function listPermissions(req, res) {
  res.json({ permissions: PERMISSIONS, scopes: SCOPES });
}

async function list(req, res) {
  res.json({ roles: await roleService.listRoles(req.user) });
}

async function create(req, res) {
  res.status(201).json({ role: await roleService.createRole(req.user, req.body) });
}

async function update(req, res) {
  res.json({ role: await roleService.updateRole(req.user, req.params.id, req.body) });
}

async function remove(req, res) {
  await roleService.deleteRole(req.user, req.params.id);
  res.status(204).end();
}

module.exports = { listPermissions, list, create, update, remove };
