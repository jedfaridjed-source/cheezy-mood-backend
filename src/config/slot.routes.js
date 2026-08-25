const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  isOpen: { type: Boolean, default: true },
  ordersEnabled: { type: Boolean, default: true },
  openingTime: { type: String, match: /^\d{2}:\d{2}$/, default: '12:00' },
  closingTime: { type: String, match: /^\d{2}:\d{2}$/, default: '21:00' },
  closingSoonMinutes: { type: Number, min: 0, max: 240, default: 60 },
  closingSoonMessage: { type: String, default: "Can't place order — we're closing soon." },
  closedMessage: { type: String, default: "We're closed and can't accept new orders." },
  updatedBy: { type: String, default: 'system' }
}, { timestamps: true });
module.exports = mongoose.model('StoreSettings', schema);
