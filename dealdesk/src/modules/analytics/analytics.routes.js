const { Router } = require('express');
const { authorize } = require('../auth/auth.middleware');
const analyticsService = require('./analytics.service');

// Same permission and scope as the deals list: the numbers cover exactly the deals you can see.
const router = Router();

router.get('/deals', authorize('deal.view'), async (req, res) => {
  res.json(await analyticsService.dealSummary(req.user, req.scope));
});

module.exports = router;
