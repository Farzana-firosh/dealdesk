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

// Scope the user holds for a permission, or null. For services that need a second permission's scope.
const scopeFor = (user, key) => user.role.permissions.find((p) => p.key === key)?.scope ?? null;

const SCOPE_RANK = { own: 0, branch: 1, all: 2 };

// Keys in `grants` the user does not hold at the same or a wider scope. Stops anyone handing out,
// or managing someone with, more access than they have themselves.
function grantsNotHeld(user, grants) {
  return grants
    .filter((g) => {
      const held = scopeFor(user, g.key);
      return !held || SCOPE_RANK[held] < SCOPE_RANK[g.scope];
    })
    .map((g) => g.key);
}

module.exports = { scopeFilter, scopeFor, grantsNotHeld };
