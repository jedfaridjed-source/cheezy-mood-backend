const mongoose = require('mongoose');

const { mongoUri } = require('./env');

async function connectDatabase() {
  await mongoose.connect(mongoUri);

  console.log('MongoDB connected');
}

module.exports = { connectDatabase };