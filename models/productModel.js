const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const specificationsSchema = new mongoose.Schema({
  model_name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  warranty: {
    type: String,
    required: true,
  },
});

const productSchema = new mongoose.Schema({
  product_name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', // Assuming you have a Category model
    required: true,
  },
  image: {
    type: [String], // Array of image URLs or paths
    validate: {
      validator: function (arr) {
        return arr.length >= 3; // Minimum 3 images required
      },
      message: 'At least 3 images are required.',
    },
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0, // Stock cannot be negative
    default: 0,
  },
  specifications: specificationsSchema,
  isBlocked: {
    type: Boolean,
    default: false,
  },
  rating: [ratingSchema],
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  discountPrice: {
    type: Number,
    default: 0,
  },
});

// Pre-save hook to calculate and set discountPrice
productSchema.pre('save', function (next) {
  if (this.discount > 0 && this.price) {
    this.discountPrice = Math.round(this.price - (this.price * this.discount) / 100);
  } else {
    this.discountPrice = this.price;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
