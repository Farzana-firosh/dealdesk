const mongoose = require('mongoose');

const DEAL_STATUSES = ['open', 'pending_approval', 'won', 'lost'];
// A fixed list, so the reasons can be counted and compared.
const LOST_REASONS = ['price', 'competitor', 'no_budget', 'timing', 'no_response', 'other'];

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 }, // price snapshot at time of adding
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // copied from the owner so branch scope is a single indexed filter
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 }, // approved discount only
    total: { type: Number, default: 0 },
    status: { type: String, enum: DEAL_STATUSES, default: 'open' },
    wonAt: Date,
    closedAt: Date, // when it was won or lost; drives the analytics periods
    lostReason: { type: String, enum: LOST_REASONS },
    lostNotes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

dealSchema.index({ ownerId: 1, createdAt: -1 });
dealSchema.index({ branchId: 1, createdAt: -1 });
dealSchema.index({ status: 1, closedAt: -1 });

dealSchema.pre('validate', function computeTotals() {
  this.subtotal = this.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  this.total = Math.round(this.subtotal * (100 - this.discountPercent)) / 100;
});

module.exports = mongoose.model('Deal', dealSchema);
module.exports.DEAL_STATUSES = DEAL_STATUSES;
module.exports.LOST_REASONS = LOST_REASONS;
