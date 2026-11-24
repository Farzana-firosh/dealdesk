const { Router } = require('express');
const { listCustomers } = require('./customer.service');

// Reference data for building deals, limited to the customers of the user's branch
// (or all branches when their deal.view scope is "all").
const router = Router();
router.get('/', async (req, res) => {
  res.json({ customers: await listCustomers(req.user) });
});

module.exports = router;
