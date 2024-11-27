const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Ensure each user has only one cart
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
        },
    ],
    totalQuantity: {
        type: Number,
        default: 0, // Calculated field for the total number of items in the cart
    },
    totalPrice: {
        type: Number,
        default: 0, // Calculated field for the total cart price
    },
}, { timestamps: true });

// Middleware to update totalQuantity and totalPrice before saving
cartSchema.pre('save', async function (next) {
    let totalQuantity = 0;
    let totalPrice = 0;

    for (const item of this.items) {
        const product = await mongoose.model('Product').findById(item.productId);
        if (product) {
            totalQuantity += item.quantity;
            totalPrice += product.price * item.quantity;
        }
    }

    this.totalQuantity = totalQuantity;
    this.totalPrice = totalPrice;
    next();
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
