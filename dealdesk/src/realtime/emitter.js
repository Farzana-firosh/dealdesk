// The one place that knows about Socket.IO rooms. Everything is delivered into rooms,
// never broadcast to all sockets.
let io = null;

const rooms = {
  user: (userId) => `user:${userId}`,
  deal: (dealId) => `deal:${dealId}`,
};

const setIo = (instance) => {
  io = instance;
};

function toUser(userId, event, payload) {
  io?.to(rooms.user(String(userId))).emit(event, payload);
}

function toDeal(dealId, event, payload) {
  io?.to(rooms.deal(String(dealId))).emit(event, payload);
}

// System notifications share one event name and the stored shape: { id, type, data, at, read }.
function notify(userId, notification) {
  toUser(userId, 'notification', notification);
}

// Closes a user's open sockets; their next handshake is checked against the database again.
function disconnectUser(userId) {
  io?.in(rooms.user(String(userId))).disconnectSockets(true);
}

module.exports = { rooms, setIo, toUser, toDeal, notify, disconnectUser };
