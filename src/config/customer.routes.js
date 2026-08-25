const mongoose = require('mongoose');
const stockRequirementSchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  quantity: { type: Number, min: 0 }
}, { _id: false });
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  base: { type: String, default: '' },
  extras: { type: [String], default: [] },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  department: { type: String, enum: ['sandwich','pasta','fries','general'], default: 'general' },
  preparationMinutes: { type: Number, min: 0, default: 5 },
  stockRequirements: { type: [stockRequirementSchema], default: [] },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  cost: { type: Number, min: 0, default: 0 }
}, { _id: false });
const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  customerSnapshot: { name: String, phone: String },
  source: { type: String, enum: ['preorder','cashier'], default: 'preorder', index: true },
  items: { type: [itemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  note: { type: String, trim: true, maxlength: 500 },
  pickupAt: { type: Date, required: true, index: true },
  pickupDateLabel: { type: String, enum: ['today','tomorrow'] },
  preparationMinutes: { type: Number, required: true, min: 1 },
  readyAt: { type: Date, index: true },
  productionStartAt: { type: Date, index: true },
  priority: { type: Number, default: 0, index: true },
  status: { type: String, enum: ['pending','accepted','preparing','ready','completed','cancelled','rejected'], default: 'pending', index: true },
  paymentStatus: { type: String, enum: ['unpaid','paid'], default: 'unpaid' },
  paymentMethod: { type: String, enum: ['cash','card','online','unknown'], default: 'unknown' },
  createdBy: { type: String, enum: ['customer','cashier'], default: 'customer' },
  statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: String, note: String }]
}, { timestamps: true });
schema.index({ status: 1, readyAt: 1, priority: 1 });
module.exports = mongoose.model('Order', schema);
