const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    // unique: a deal converts into at most one sale
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    amount: { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Sale', saleSchema);
