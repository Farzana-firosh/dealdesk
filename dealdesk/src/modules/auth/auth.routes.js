const { Router } = require('express');
const Joi = require('joi');
const { validate } = require('../../common/middleware/validate');
const { authenticate } = require('./auth.middleware');
const controller = require('./auth.controller');

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const router = Router();
router.post('/login', validate(loginSchema), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
