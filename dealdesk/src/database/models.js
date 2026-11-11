// Registers every Mongoose model at startup so populate() can resolve refs
// to models that no route has loaded yet.
require('../modules/branches/branch.model');
require('../modules/roles/role.model');
require('../modules/users/user.model');
require('../modules/customers/customer.model');
require('../modules/products/product.model');
require('../modules/deals/deal.model');
