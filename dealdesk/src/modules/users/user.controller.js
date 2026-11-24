const userService = require('./user.service');

async function list(req, res) {
  res.json({ users: await userService.listUsers(req.user, req.scope) });
}

async function options(req, res) {
  res.json(await userService.formOptions(req.user, req.scope));
}

async function create(req, res) {
  res.status(201).json({ user: await userService.createUser(req.user, req.scope, req.body) });
}

async function update(req, res) {
  res.json({ user: await userService.updateUser(req.user, req.scope, req.params.id, req.body) });
}

module.exports = { list, options, create, update };
