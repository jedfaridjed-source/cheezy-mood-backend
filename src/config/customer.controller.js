const mongoose = require('mongoose');
const { mongoUri } = require('./env');
async function connectDatabase() {
  if (!mongoUri) throw new Error('MONGO_URI is not configured.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
module.exports = { connectDatabase };
