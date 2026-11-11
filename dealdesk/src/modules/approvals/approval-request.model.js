const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema(
  {
    step: { type: Number, required: true }, // 1-based
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    roleName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { _id: false },
);

// One discount request = one chain, snapshotted from the config at request time.
const approvalRequestSchema = new mongoose.Schema(
  {
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    remarks: String,
    steps: { type: [stepSchema], default: [] },
    currentStep: { type: Number, default: null },
    // role whose decision is awaited; null once the chain is finished
    currentRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    configVersion: Number,
    decidedAt: Date,
  },
  { timestamps: true },
);

// at most one open chain per deal
approvalRequestSchema.index({ dealId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
approvalRequestSchema.index({ status: 1, currentRoleId: 1, branchId: 1 });

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);
