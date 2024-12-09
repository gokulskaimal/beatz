const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  applicableProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  applicableCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  offerType: { type: String, enum: ['Product', 'Category'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);

  