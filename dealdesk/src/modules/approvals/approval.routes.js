const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const controller = require('./approval.controller');

const approveSchema = Joi.object({ remarks: Joi.string().trim().allow('') });
const rejectSchema = Joi.object({ remarks: Joi.string().trim().required() }); // a rejection must say why

const configSchema = Joi.object({
  bands: Joi.array()
    .min(1)
    .items(
      Joi.object({
        minPercent: Joi.number().min(0).max(100).required(),
        maxPercent: Joi.number().min(0).max(100).required(),
        steps: Joi.array().items(Joi.string().trim()).required(),
      }),
    )
    .required(),
});

const router = Router();
router.get('/pending', authorize('discount.approve'), controller.pending);
router.post('/:id/approve', authorize('discount.approve'), validate(approveSchema), controller.approve);
router.post('/:id/reject', authorize('discount.approve'), validate(rejectSchema), controller.reject);

const configRouter = Router();
configRouter.use(authorize('approval_config.manage'));
configRouter.get('/', controller.getConfig);
configRouter.put('/', validate(configSchema), controller.replaceConfig);

module.exports = { approvalRouter: router, approvalConfigRouter: configRouter };
