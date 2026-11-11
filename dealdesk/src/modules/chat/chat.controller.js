const chatService = require('./chat.service');

async function listThreads(req, res) {
  res.json({ threads: await chatService.listThreads(req.user) });
}

async function listMessages(req, res) {
  res.json({ messages: await chatService.listMessages(req.user, req.params.dealId, req.query) });
}

async function postMessage(req, res) {
  res.status(201).json({ message: await chatService.postMessage(req.user, req.params.dealId, req.body.text) });
}

async function markRead(req, res) {
  await chatService.markRead(req.user, req.params.dealId);
  res.status(204).end();
}

module.exports = { listThreads, listMessages, postMessage, markRead };
