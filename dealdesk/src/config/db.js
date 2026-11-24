const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../common/logger');

async function connectDb() {
  await mongoose.connect(env.mongoUri);
  logger.info({ db: mongoose.connection.name }, 'database connected');
}

module.exports = { connectDb };
