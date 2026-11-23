const { Router } = require('express');
const notificationService = require('./notification.service');

// No permission needed: everyone signed in has notifications, and only ever sees their own.
const router = Router();

router.get('/', async (req, res) => {
  res.json(await notificationService.listFor(req.user));
});

router.post('/read', async (req, res) => {
  await notificationService.markAllRead(req.user);
  res.status(204).end();
});

module.exports = router;
