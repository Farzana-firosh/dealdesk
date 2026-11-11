const Thread = require('./thread.model');
const Message = require('./message.model');
const Deal = require('../deals/deal.model');
const User = require('../users/user.model');
const AppError = require('../../common/errors/AppError');
const { scopeFilter, scopeFor } = require('../auth/scope');
const { publish, EVENTS } = require('../../common/events');

/** Creates the deal's thread on first use with its default participants: owner + owner's manager. */
async function ensureThread(dealId) {
  const existing = await Thread.findOne({ dealId });
  if (existing) return existing;

  const deal = await Deal.findById(dealId, 'ownerId').lean();
  if (!deal) throw AppError.notFound('Deal not found');
  const owner = await User.findById(deal.ownerId, 'managerId').lean();
  const userIds = [deal.ownerId, owner?.managerId].filter(Boolean);

  return Thread.findOneAndUpdate(
    { dealId },
    { $setOnInsert: { dealId, participants: userIds.map((userId) => ({ userId })) } },
    { upsert: true, returnDocument: 'after' },
  );
}

const isParticipant = (thread, user) => thread.participants.some((p) => String(p.userId) === user.id);

// Read access: participants only. A non-participant gets 404, as if the thread did not exist.
async function getThreadFor(user, dealId) {
  const thread = await Thread.findOne({ dealId, 'participants.userId': user._id });
  if (thread) return thread;

  // owner / manager may not have a thread yet (lazy creation)
  const created = await ensureThread(dealId).catch(() => null);
  if (created && isParticipant(created, user)) return created;
  throw AppError.notFound('Thread not found');
}

async function listThreads(user) {
  const threads = await Thread.find({ 'participants.userId': user._id })
    .sort({ updatedAt: -1 })
    .populate('dealId', 'title status')
    .lean();

  return threads.map((t) => {
    const me = t.participants.find((p) => String(p.userId) === user.id);
    return { dealId: t.dealId?._id, deal: t.dealId, lastMessage: t.lastMessage, unreadCount: me.unreadCount, participantCount: t.participants.length };
  });
}

async function listMessages(user, dealId, { before, limit = 50 } = {}) {
  const thread = await getThreadFor(user, dealId);
  const messages = await Message.find({ threadId: thread._id, ...(before && { createdAt: { $lt: new Date(before) } }) })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();
  return messages.reverse();
}

/**
 * Posting requires chat.send and visibility of the deal (deal.view scope).
 * Commenting makes a user a participant: "anyone who comments".
 */
async function postMessage(user, dealId, text) {
  if (!scopeFor(user, 'chat.send')) throw AppError.forbidden('Missing permission: chat.send');
  const body = String(text ?? '').trim();
  if (!body) throw AppError.badRequest('Message text is required');

  const thread = await ensureThread(dealId);
  if (!isParticipant(thread, user)) {
    const viewScope = scopeFor(user, 'deal.view');
    const canSee = viewScope && (await Deal.exists({ _id: dealId, ...scopeFilter(user, viewScope) }));
    if (!canSee) throw AppError.notFound('Thread not found');

    await Thread.updateOne({ _id: thread._id, 'participants.userId': { $ne: user._id } }, { $push: { participants: { userId: user._id } } });
  }

  const message = await Message.create({ threadId: thread._id, dealId, senderId: user._id, senderName: user.name, text: body });

  // everyone else +1 unread; the sender has read up to now
  const updated = await Thread.findOneAndUpdate(
    { _id: thread._id },
    {
      $set: {
        lastMessage: { text: body, senderId: user._id, senderName: user.name, createdAt: message.createdAt },
        'participants.$[me].unreadCount': 0,
        'participants.$[me].lastReadAt': message.createdAt,
      },
      $inc: { 'participants.$[other].unreadCount': 1 },
    },
    { arrayFilters: [{ 'me.userId': user._id }, { 'other.userId': { $ne: user._id } }], returnDocument: 'after' },
  );

  publish(EVENTS.CHAT_MESSAGE, {
    dealId: String(dealId),
    message: message.toObject(),
    participantIds: updated.participants.map((p) => String(p.userId)),
  });
  return message;
}

async function markRead(user, dealId) {
  const res = await Thread.updateOne(
    { dealId, 'participants.userId': user._id },
    { $set: { 'participants.$.unreadCount': 0, 'participants.$.lastReadAt': new Date() } },
  );
  if (!res.matchedCount) throw AppError.notFound('Thread not found');
}

module.exports = { ensureThread, getThreadFor, listThreads, listMessages, postMessage, markRead };
