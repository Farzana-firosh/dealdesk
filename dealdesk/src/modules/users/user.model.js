const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ roleId: 1, branchId: 1 });

module.exports = mongoose.model('User', userSchema);
