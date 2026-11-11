const { Server } = require('socket.io');
const authService = require('../modules/auth/auth.service');
const chatService = require('../modules/chat/chat.service');
const { rooms, setIo } = require('./emitter');

// Wraps a socket handler so every result/error goes back through the client's ack callback.
const withAck = (handler) => async (payload, ack = () => {}) => {
  try {
    ack({ ok: true, ...(await handler(payload)) });
  } catch (err) {
    ack({ ok: false, error: err.status && err.status < 500 ? err.message : 'Internal error' });
  }
};

function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true } });

  // Rejected at the handshake: no token, no connection.
  io.use(async (socket, next) => {
    try {
      socket.data.user = await authService.principalFromToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(rooms.user(user.id)); // personal room: notifications + thread list updates

    // Joining a deal room is allowed for participants only, checked on the server.
    socket.on('thread:join', withAck(async ({ dealId }) => {
      await chatService.getThreadFor(user, dealId);
      socket.join(rooms.deal(dealId));
      return {};
    }));

    socket.on('thread:leave', withAck(async ({ dealId }) => {
      socket.leave(rooms.deal(dealId));
      return {};
    }));

    // Same service as the REST endpoint; delivery happens via the chat.message event.
    socket.on('chat:send', withAck(async ({ dealId, text }) => {
      const message = await chatService.postMessage(user, dealId, text);
      socket.join(rooms.deal(dealId)); // a first-time commenter is now a participant
      return { message };
    }));

    // bonus: typing indicator, only relayed inside a room the socket has joined
    socket.on('chat:typing', ({ dealId } = {}) => {
      if (socket.rooms.has(rooms.deal(dealId))) {
        socket.to(rooms.deal(dealId)).emit('chat:typing', { dealId, userId: user.id, name: user.name });
      }
    });
  });

  setIo(io);
  return io;
}

module.exports = { initSocket };
