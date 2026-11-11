const AppError = require('../../common/errors/AppError');
const authService = require('./auth.service');

async function authenticate(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) throw AppError.unauthorized('Missing bearer token');

  req.user = await authService.principalFromToken(token);
  next();
}

// The single permission guard. Sets req.scope (own | branch | all) for the service layer.
function authorize(permissionKey) {
  return (req, res, next) => {
    const grant = req.user.role.permissions.find((p) => p.key === permissionKey);
    if (!grant) throw AppError.forbidden(`Missing permission: ${permissionKey}`);

    req.scope = grant.scope;
    next();
  };
}

module.exports = { authenticate, authorize };
