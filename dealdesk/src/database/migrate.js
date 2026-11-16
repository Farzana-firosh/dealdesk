// Data changes for databases that already exist (the hosted one is never reseeded).
// Each step runs once and is recorded in `migrations`; every step is also written so that
// running it again changes nothing. Runs on server start-up, or by hand with `npm run migrate`.
const mongoose = require('mongoose');
const Role = require('../modules/roles/role.model');
const logger = require('../common/logger');

const Migration = mongoose.model(
  'Migration',
  new mongoose.Schema({ _id: String, appliedAt: { type: Date, default: Date.now } }, { versionKey: false }),
);

const MIGRATIONS = [
  {
    id: '2026-11-16-admin-user-manage',
    // Recorded once, so an admin who later removes the permission on purpose keeps that choice.
    up: () =>
      Role.updateOne(
        { name: 'admin', 'permissions.key': { $ne: 'user.manage' } },
        { $push: { permissions: { key: 'user.manage', scope: 'all' } } },
      ),
  },
];

async function runMigrations() {
  for (const { id, up } of MIGRATIONS) {
    if (await Migration.exists({ _id: id })) continue;
    await up();
    // upsert: two instances starting together both finish without a duplicate-key error
    await Migration.updateOne({ _id: id }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
    logger.info({ migration: id }, 'migration applied');
  }
}

module.exports = { runMigrations };

if (require.main === module) {
  const { connectDb } = require('../config/db');
  connectDb()
    .then(runMigrations)
    .catch((err) => {
      logger.error({ err }, 'migration failed');
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
