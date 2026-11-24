const mongoose = require('mongoose');

// One document per recipient, so read state is per user and offline users still get it.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // discount.requested | discount.decided | invoice.status_changed
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
// Old notifications are history, not state: MongoDB removes them after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
