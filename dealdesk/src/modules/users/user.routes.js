const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const controller = require('./user.controller');

const objectId = Joi.string().hex().length(24);
const name = Joi.string().trim().max(100);
// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently cut
const password = Joi.string().min(8).max(72);

const createSchema = Joi.object({
  name: name.required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: password.required(),
  roleId: objectId.required(),
  branchId: objectId.required(),
  managerId: objectId.allow(null).default(null),
});

// Email is the sign-in name and stays fixed; deactivate and add a new user instead.
const updateSchema = Joi.object({
  name,
  password,
  roleId: objectId,
  branchId: objectId,
  managerId: objectId.allow(null),
  active: Joi.boolean(),
}).min(1);

const router = Router();
router.use(authorize('user.manage'));
router.get('/options', controller.options);
router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.patch('/:id', validate(updateSchema), controller.update);

module.exports = router;
