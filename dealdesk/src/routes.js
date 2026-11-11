const { Router } = require('express');
const { authenticate } = require('./modules/auth/auth.middleware');
const { approvalRouter, approvalConfigRouter } = require('./modules/approvals/approval.routes');

const router = Router();

router.use('/auth', require('./modules/auth/auth.routes'));

// everything below requires a valid JWT
router.use(authenticate);
router.use('/roles', require('./modules/roles/role.routes'));
router.use('/customers', require('./modules/customers/customer.routes'));
router.use('/products', require('./modules/products/product.routes'));
router.use('/deals', require('./modules/deals/deal.routes'));
router.use('/approvals', approvalRouter);
router.use('/approval-config', approvalConfigRouter);

module.exports = router;
