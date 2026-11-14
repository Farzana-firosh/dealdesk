const Customer = require('./customer.model');
const AppError = require('../../common/errors/AppError');
const { scopeFor } = require('../auth/scope');

/**
 * Customers belong to a branch and have no owner, so "own" and "branch" both mean the user's
 * branch. Only users whose deal.view scope is "all" see every branch's customers.
 */
function customerFilter(user) {
  return scopeFor(user, 'deal.view') === 'all' ? {} : { branchId: user.branchId };
}

// Reference data is for people who work with deals.
function assertCanUseReferenceData(user) {
  if (!scopeFor(user, 'deal.view') && !scopeFor(user, 'deal.edit')) {
    throw AppError.forbidden('Missing permission: deal.view');
  }
}

function listCustomers(user) {
  assertCanUseReferenceData(user);
  return Customer.find(customerFilter(user)).sort({ name: 1 }).lean();
}

// An out-of-scope customer behaves exactly like a missing one.
async function assertCustomerInScope(user, customerId) {
  if (!(await Customer.exists({ _id: customerId, ...customerFilter(user) }))) {
    throw AppError.badRequest('Unknown customer');
  }
}

module.exports = { customerFilter, assertCanUseReferenceData, listCustomers, assertCustomerInScope };
