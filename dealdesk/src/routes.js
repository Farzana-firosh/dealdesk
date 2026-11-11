const { Router } = require('express');
const { authenticate } = require('./modules/auth/auth.middleware');

const router = Router();

router.use('/auth', require('./modules/auth/auth.routes'));

// everything below requires a valid JWT
router.use(authenticate);
router.use('/roles', require('./modules/roles/role.routes'));

module.exports = router;
