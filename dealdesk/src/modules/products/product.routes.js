const { Router } = require('express');
const Product = require('./product.model');
const { assertCanUseReferenceData } = require('../customers/customer.service');

// The product catalogue is company-wide (products have no branch), but it is still
// reference data for deal work, so it needs the same permission as the customer list.
const router = Router();
router.get('/', async (req, res) => {
  assertCanUseReferenceData(req.user);
  res.json({ products: await Product.find().sort({ name: 1 }).lean() });
});

module.exports = router;
