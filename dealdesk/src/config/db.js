const mongoose = require('mongoose');
const env = require('./env');

async function connectDb() {
  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}

module.exports = { connectDb };
