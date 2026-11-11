const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    // amount invoiced but not yet paid
    outstandingBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Customer', customerSchema);
