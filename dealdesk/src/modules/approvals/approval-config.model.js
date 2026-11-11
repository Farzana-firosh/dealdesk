const mongoose = require('mongoose');

// A band covers discounts where minPercent < discount <= maxPercent.
// Empty steps = auto-approved.
const bandSchema = new mongoose.Schema(
  {
    minPercent: { type: Number, required: true, min: 0 },
    maxPercent: { type: Number, required: true, max: 100 },
    steps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  },
  { _id: false },
);

// Single active document (key: 'discount'). Read on every request, so edits apply without a restart.
const approvalConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'discount' },
    bands: { type: [bandSchema], required: true },
    version: { type: Number, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ApprovalConfig', approvalConfigSchema);
