const mongoose = require('mongoose');

// Inbox of verified webhooks. The unique eventId is what makes a duplicate a no-op.
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    externalId: { type: String, required: true },
    status: { type: String, required: true },
    sequence: { type: Number, required: true },
    occurredAt: Date,
    payload: Object,
    // received -> processed | ignored (stale) | gave_up
    state: { type: String, default: 'received' },
    attempts: { type: Number, default: 0 },
    processedAt: Date,
  },
  { timestamps: true },
);

webhookEventSchema.index({ state: 1, createdAt: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema, 'webhook_events');
