const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const { PERMISSION_KEYS, SCOPES } = require('./permissions');
const controller = require('./role.controller');

const grants = Joi.array().items(
  Joi.object({
    key: Joi.string().valid(...PERMISSION_KEYS).required(),
    scope: Joi.string().valid(...SCOPES).default('own'),
  }),
);

const createSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().allow(''),
  permissions: grants.default([]),
});

const updateSchema = Joi.object({
  description: Joi.string().allow(''),
  permissions: grants,
}).min(1);

const router = Router();
router.use(authorize('role.manage'));
router.get('/permissions', controller.listPermissions);
router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.patch('/:id', validate(updateSchema), controller.update);

module.exports = router;
