const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  couponType: {
    type: String,
    enum: ['Percentage', 'Fixed'],
    required: true
  },
  couponValue: {
    type: Number,
    required: true
  },
  minPurchaseAmount: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  totalUsageLimit: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageByUser: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);

