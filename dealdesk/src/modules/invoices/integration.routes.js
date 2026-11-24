const { Router } = require('express');
const { authorize } = require('../auth/auth.middleware');
const { getHealth } = require('./integration-health.service');

// Counts cover every invoice, so this has its own permission rather than invoice.view's scopes.
const router = Router();

router.get('/health', authorize('integration.view'), async (req, res) => {
  res.json(await getHealth());
});

module.exports = router;
