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
      required: true
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
    subtotal: Number,
    status: { 
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Return Rejected'],
      default: 'Pending'
    },
    returnReason: String,
    returnRequestDate: Date,
    returnProcessedDate: Date
  }],
  payment: {
    paymentMethod: {
      type: String,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded', 'Partially Refunded'],
      default: 'Pending'
    },
    totalAmount: Number,
    discount: Number,
    discountPrice: Number,
    couponDiscount: { 
      type: Number,
      default: 0 
    },
    appliedCoupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
      },
      code: String,
      discountAmount: Number
    },
    refundedAmount: {
      type: Number,
      default: 0
    },
    razorpayOrderId: {
      type: String
    },
    razorpayPaymentId: {
      type: String
    }
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Partially Cancelled'],
    default: 'Pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
