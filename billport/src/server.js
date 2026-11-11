require('dotenv').config({ quiet: true });
const express = require('express');
const mongoose = require('mongoose');

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billport';

const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'billport' }));

async function start() {
  await mongoose.connect(MONGO_URI);
  app.listen(PORT, () => console.log(`[billport] listening on :${PORT}`));
}

start().catch((err) => {
  console.error('[billport] failed to start', err);
  process.exit(1);
});
