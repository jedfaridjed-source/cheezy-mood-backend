const mongoose = require('mongoose');
const articleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['base','extra','product'], default: 'product', index: true },
  department: { type: String, enum: ['sandwich','pasta','fries','general'], default: 'general', index: true },
  price: { type: Number, min: 0, default: 0 },
  cost: { type: Number, min: 0, default: 0 },
  stock: { type: Number, min: 0, default: 0 },
  minimumStock: { type: Number, min: 0, default: 0 },
  preparationMinutes: { type: Number, min: 0, default: 5 },
  active: { type: Boolean, default: true },
  unlimitedStock: { type: Boolean, default: false },
  unit: { type: String, default: 'portion' }
}, { timestamps: true });
articleSchema.virtual('available').get(function() { return this.active && (this.unlimitedStock || this.stock > 0); });
articleSchema.virtual('stockStatus').get(function() {
  if (!this.active) return 'inactive';
  if (this.unlimitedStock) return 'unlimited';
  if (this.stock <= 0) return 'out';
  if (this.stock <= this.minimumStock) return 'low';
  return 'ok';
});
articleSchema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Article', articleSchema);
