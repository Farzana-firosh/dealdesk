const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const User = require('../users/user.model');
const AppError = require('../../common/errors/AppError');

function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

// The authenticated user as the rest of the app sees it.
// Role is loaded from the DB on every request, so permission changes apply immediately.
function toPrincipal(user) {
  return {
    _id: user._id,
    id: String(user._id),
    name: user.name,
    email: user.email,
    branchId: user.branchId,
    managerId: user.managerId,
    role: {
      _id: user.roleId._id,
      name: user.roleId.name,
      permissions: user.roleId.permissions,
    },
  };
}

async function login(email, password) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true })
    .select('+passwordHash')
    .populate('roleId');

  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw AppError.unauthorized('Invalid email or password');

  return { token: signToken(user), user: toPrincipal(user) };
}

async function principalFromToken(token) {
  const { sub } = verifyToken(token);
  const user = await User.findOne({ _id: sub, active: true }).populate('roleId').lean();
  if (!user || !user.roleId) throw AppError.unauthorized('User no longer active');
  return toPrincipal(user);
}

const hashPassword = (plain) => bcrypt.hash(plain, 10);

module.exports = { login, principalFromToken, hashPassword };
