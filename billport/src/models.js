const mongoose = require('mongoose');

const STATUSES = ['QUEUED', 'SENT', 'VIEWED', 'PAID', 'FAILED'];

const invoiceSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true },
    // the guarantee behind "same key -> same externalId"
    idempotencyKey: { type: String, required: true, unique: true },
    payload: Object,
    status: { type: String, enum: STATUSES, default: 'QUEUED' },
    sequence: { type: Number, default: 0 },
    nextTransitionAt: { type: Date, index: true },
  },
  { timestamps: true },
);

const deliverySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true }, // not unique: duplicates are deliberate
    externalId: { type: String, required: true, index: true },
    body: { type: Object, required: true },
    sendAt: { type: Date, required: true },
    tamper: { type: Boolean, default: false },
    duplicate: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    state: { type: String, enum: ['pending', 'sending', 'delivered', 'failed', 'dropped'], default: 'pending' },
    lastResponse: String,
  },
  { timestamps: true },
);
deliverySchema.index({ state: 1, sendAt: 1 });

module.exports = {
  Invoice: mongoose.model('Invoice', invoiceSchema),
  Delivery: mongoose.model('Delivery', deliverySchema),
};
