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

// System notifications share one event name and envelope: { type, data, at }.
function notify(userId, type, data) {
  toUser(userId, 'notification', { type, data, at: new Date().toISOString() });
}

module.exports = { rooms, setIo, toUser, toDeal, notify };
