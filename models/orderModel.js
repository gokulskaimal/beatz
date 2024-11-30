// models/orderModel.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    customerName: {
      type: String,
      required: true
    },
    customerEmail: {
      type: String,
      required: false
    },
    shippingAddress: {
      name: String,
      addressType: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phone: String
    }
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: String,
    quantity: Number,
    price: Number,
    discountPrice: Number,
    subtotal: Number
  }],
  payment: {
    paymentMethod: {
      type: String,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending'
    },
    totalAmount: Number,
    discount: Number,
    discountPrice: Number
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);