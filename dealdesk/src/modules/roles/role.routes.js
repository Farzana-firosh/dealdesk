const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const { PERMISSION_KEYS, SCOPES } = require('./permissions');
const controller = require('./role.controller');

const grants = Joi.array()
  .items(
    Joi.object({
      key: Joi.string().valid(...PERMISSION_KEYS).required(),
      scope: Joi.string().valid(...SCOPES).default('own'),
    }),
  )
  .unique('key'); // one scope per permission

const description = Joi.string().trim().max(200).allow('');

// Names are typed into the approval rules, so they stay simple: sales_lead, regional_auditor.
// A name is fixed once created.
const createSchema = Joi.object({
  name: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(40).required()
    .messages({ 'string.pattern.base': 'Role names use lowercase letters, numbers and _' }),
  description,
  permissions: grants.default([]),
});

const updateSchema = Joi.object({ description, permissions: grants }).min(1);

const router = Router();
router.use(authorize('role.manage'));
router.get('/permissions', controller.listPermissions);
router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.patch('/:id', validate(updateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
