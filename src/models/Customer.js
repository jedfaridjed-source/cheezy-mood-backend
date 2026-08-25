const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true },
  notes: { type: String, trim: true, maxlength: 500 },
  profilePicture: { type: String, default: '', maxlength: 280000 }
}, { timestamps: true });
schema.index({ phone: 1 }, { unique: true });
module.exports = mongoose.model('Customer', schema);
