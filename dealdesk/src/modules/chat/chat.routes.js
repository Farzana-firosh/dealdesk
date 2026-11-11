const { Router } = require('express');
const Joi = require('joi');
const { authorize } = require('../auth/auth.middleware');
const { validate } = require('../../common/middleware/validate');
const controller = require('./chat.controller');

const messageSchema = Joi.object({ text: Joi.string().trim().min(1).max(2000).required() });

// Thread membership (participants) is the access rule here; chat.send gates using chat at all.
const router = Router();
router.use(authorize('chat.send'));
router.get('/', controller.listThreads);
router.get('/:dealId/messages', controller.listMessages);
router.post('/:dealId/messages', validate(messageSchema), controller.postMessage);
router.post('/:dealId/read', controller.markRead);

module.exports = router;
