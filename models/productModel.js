const mongoose = require('mongoose');

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
    ref: 'Category',
    required: true,
  },
  image: {
    type: [String],
    validate: {
      validator: function (arr) {
        return arr.length >= 3;
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
    min: 0,
    default: 0,
  },
  specifications: specificationsSchema,
  isBlocked: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
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
},{ timestamps: true });

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