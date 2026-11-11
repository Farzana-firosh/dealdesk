const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // stored, not computed from sockets, so it is correct for users who were offline
    unreadCount: { type: Number, default: 0 },
    lastReadAt: Date,
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const threadSchema = new mongoose.Schema(
  {
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true, unique: true }, // one thread per deal
    participants: { type: [participantSchema], default: [] },
    lastMessage: {
      text: String,
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      senderName: String,
      createdAt: Date,
    },
  },
  { timestamps: true },
);

threadSchema.index({ 'participants.userId': 1, updatedAt: -1 });

module.exports = mongoose.model('Thread', threadSchema);
