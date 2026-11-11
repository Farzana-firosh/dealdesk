const roleService = require('./role.service');
const { PERMISSIONS, SCOPES } = require('./permissions');

function listPermissions(req, res) {
  res.json({ permissions: PERMISSIONS, scopes: SCOPES });
}

async function list(req, res) {
  res.json({ roles: await roleService.listRoles() });
}

async function create(req, res) {
  res.status(201).json({ role: await roleService.createRole(req.body) });
}

async function update(req, res) {
  res.json({ role: await roleService.updateRole(req.params.id, req.body) });
}

module.exports = { listPermissions, list, create, update };
