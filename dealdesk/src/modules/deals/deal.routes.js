const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const controller = require('./deal.controller');
const approvalController = require('../approvals/approval.controller');

const objectId = Joi.string().hex().length(24);
const items = Joi.array()
  .min(1)
  .items(Joi.object({ productId: objectId.required(), quantity: Joi.number().integer().min(1).required() }));

const createSchema = Joi.object({
  title: Joi.string().trim().required(),
  customerId: objectId.required(),
  items: items.required(),
});

const updateSchema = Joi.object({
  title: Joi.string().trim(),
  customerId: objectId,
  items,
}).min(1);

const router = Router();
router.get('/', authorize('deal.view'), controller.list);
router.get('/:id', authorize('deal.view'), controller.getOne);
router.post('/', authorize('deal.edit'), validate(createSchema), controller.create);
router.patch('/:id', authorize('deal.edit'), validate(updateSchema), controller.update);

const discountSchema = Joi.object({
  discountPercent: Joi.number().min(0).max(100).required(),
  remarks: Joi.string().trim().allow(''),
});
router.post('/:id/discount-request', authorize('deal.edit'), validate(discountSchema), approvalController.requestDiscount);
router.get('/:id/approvals', authorize('deal.view'), approvalController.dealHistory);

module.exports = router;
