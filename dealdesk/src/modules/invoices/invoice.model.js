const mongoose = require('mongoose');

const INVOICE_STATUSES = ['pending', 'sent', 'viewed', 'paid', 'failed', 'cancelled'];
const FINAL_STATUSES = ['paid', 'failed', 'cancelled'];
// queued/retrying = waiting for the worker · succeeded = BillPort has it · failed = gave up (terminal)
const PUSH_STATUSES = ['queued', 'retrying', 'succeeded', 'failed', 'cancelled'];

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, unique: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'AED' },
    status: { type: String, enum: INVOICE_STATUSES, default: 'pending' },
    statusUpdatedAt: { type: Date, default: Date.now },

    // BillPort integration
    idempotencyKey: { type: String, required: true, unique: true }, // generated once, reused on every retry
    externalId: { type: String, unique: true, sparse: true },
    lastSequence: { type: Number, default: 0 }, // highest webhook sequence applied
    pushStatus: { type: String, enum: PUSH_STATUSES, default: 'queued' },
    pushAttempts: { type: Number, default: 0 },
    nextPushAt: { type: Date, default: Date.now },
    pushLockedUntil: { type: Date, default: null },
    pushError: String,
    lastReconciledAt: Date,
  },
  { timestamps: true },
);

invoiceSchema.index({ pushStatus: 1, nextPushAt: 1 }); // push worker
invoiceSchema.index({ status: 1, statusUpdatedAt: 1 }); // reconciliation
invoiceSchema.index({ ownerId: 1 });
invoiceSchema.index({ branchId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
Object.assign(module.exports, { INVOICE_STATUSES, FINAL_STATUSES });
