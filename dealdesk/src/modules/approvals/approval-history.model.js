const mongoose = require('mongoose');

const approvalHistorySchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', required: true, index: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    step: { type: Number, required: true }, // 0 = the request itself
    approverRole: { type: String, required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['requested', 'auto_approved', 'approved', 'rejected'], required: true },
    remarks: String,
    timestamp: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

// Audit record: insert-only. Every update/delete path is blocked at the model level.
function blockMutation() {
  throw new Error('approval_history is append-only');
}

approvalHistorySchema.pre('save', function onlyInserts() {
  if (!this.isNew) blockMutation();
});

['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach(
  (op) => approvalHistorySchema.pre(op, blockMutation),
);

module.exports = mongoose.model('ApprovalHistory', approvalHistorySchema, 'approval_history');
