const AppError = require('../../common/errors/AppError');

/**
 * Turns a permission scope into a Mongo filter that is merged into the query,
 * so out-of-scope records are never loaded.
 */
function scopeFilter(user, scope, { ownerField = 'ownerId', branchField = 'branchId' } = {}) {
  switch (scope) {
    case 'all':
      return {};
    case 'branch':
      return { [branchField]: user.branchId };
    case 'own':
      return { [ownerField]: user._id };
    default:
      throw AppError.forbidden('Unknown scope');
  }
}

module.exports = { scopeFilter };
