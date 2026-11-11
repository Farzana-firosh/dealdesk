const authService = require('./auth.service');

async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  res.json(result);
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };
