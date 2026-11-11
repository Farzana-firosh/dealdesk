// Registers every Mongoose model at startup so populate() can resolve refs
// to models that no route has loaded yet.
require('../modules/branches/branch.model');
require('../modules/roles/role.model');
require('../modules/users/user.model');
require('../modules/customers/customer.model');
require('../modules/products/product.model');
require('../modules/deals/deal.model');
require('../modules/approvals/approval-config.model');
require('../modules/approvals/approval-request.model');
require('../modules/approvals/approval-history.model');
require('../modules/invoices/sale.model');
require('../modules/invoices/invoice.model');
require('../modules/invoices/integration-log.model');
require('../modules/invoices/webhook-event.model');
require('../modules/chat/thread.model');
require('../modules/chat/message.model');
