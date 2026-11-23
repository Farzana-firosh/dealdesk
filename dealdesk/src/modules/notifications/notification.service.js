const Notification = require('./notification.model');

const LIST_LIMIT = 30;

// The shape sent over the socket and returned by the API.
const toView = (n) => ({ id: String(n._id), type: n.type, data: n.data, at: n.createdAt, read: Boolean(n.readAt) });

// Stores one notification per recipient and returns them, ready to deliver.
async function createMany(userIds, type, data) {
  if (!userIds.length) return [];
  const docs = await Notification.insertMany(userIds.map((userId) => ({ userId, type, data })));
  return docs.map(toView);
}

// The user's latest notifications and how many are unread. Only ever their own.
async function listFor(user) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: user.id }).sort({ createdAt: -1, _id: -1 }).limit(LIST_LIMIT).lean(),
    Notification.countDocuments({ userId: user.id, readAt: null }),
  ]);
  return { notifications: items.map(toView), unread };
}

const markAllRead = (user) => Notification.updateMany({ userId: user.id, readAt: null }, { readAt: new Date() });

module.exports = { createMany, listFor, markAllRead };
