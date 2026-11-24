const { Router } = require('express');
const Joi = require('joi');
const { validate } = require('../../common/middleware/validate');
const { loginLimit } = require('../../common/middleware/rateLimit');
const { authenticate } = require('./auth.middleware');
const controller = require('./auth.controller');
const { DEMO_KEYS } = require('./demo');

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const demoSchema = Joi.object({ account: Joi.string().valid(...DEMO_KEYS).required() });

const router = Router();
router.post('/login', loginLimit, validate(loginSchema), controller.login);
router.get('/demo', controller.demoAccounts);
router.post('/demo', validate(demoSchema), controller.demoLogin);
router.get('/me', authenticate, controller.me);

module.exports = router;
