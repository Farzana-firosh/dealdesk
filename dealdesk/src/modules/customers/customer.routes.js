const { Router } = require('express');
const Customer = require('./customer.model');

// Reference data for building deals; any authenticated user may read it.
const router = Router();
router.get('/', async (req, res) => {
  res.json({ customers: await Customer.find().sort({ name: 1 }).lean() });
});

module.exports = router;
