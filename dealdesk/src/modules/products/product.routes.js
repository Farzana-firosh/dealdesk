const { Router } = require('express');
const Product = require('./product.model');

// Reference data for building deals; any authenticated user may read it.
const router = Router();
router.get('/', async (req, res) => {
  res.json({ products: await Product.find().sort({ name: 1 }).lean() });
});

module.exports = router;
