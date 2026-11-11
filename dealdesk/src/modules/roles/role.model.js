const mongoose = require('mongoose');
const { PERMISSION_KEYS, SCOPES } = require('./permissions');

const grantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: PERMISSION_KEYS },
    scope: { type: String, enum: SCOPES, default: 'own' },
  },
  { _id: false },
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    permissions: { type: [grantSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Role', roleSchema);
