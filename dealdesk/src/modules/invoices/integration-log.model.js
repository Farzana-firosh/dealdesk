const mongoose = require('mongoose');

// Every outbound attempt and inbound event with payload, response and outcome.
// Answers "why does this invoice say unpaid?".
const integrationLogSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
    externalId: { type: String, index: true },
    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    action: { type: String, enum: ['push', 'webhook', 'reconcile'], required: true },
    eventId: String,
    request: Object,
    response: Object,
    outcome: { type: String, required: true },
    error: String,
    durationMs: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

module.exports = mongoose.model('IntegrationLog', integrationLogSchema, 'integration_logs');
