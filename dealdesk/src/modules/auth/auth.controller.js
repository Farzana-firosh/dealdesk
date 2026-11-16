const env = require('../../config/env');
const authService = require('./auth.service');
const { publicDemoAccounts } = require('./demo');

async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  res.json(result);
}

function me(req, res) {
  res.json({ user: req.user });
}

// Tells the login page whether to show the one-click demo buttons.
function demoAccounts(req, res) {
  res.json({ enabled: env.demoMode, accounts: env.demoMode ? publicDemoAccounts() : [] });
}

async function demoLogin(req, res) {
  res.json(await authService.demoLogin(req.body.account));
}

module.exports = { login, me, demoAccounts, demoLogin };
