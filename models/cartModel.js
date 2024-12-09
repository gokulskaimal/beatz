const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            finalPrice: { type: Number },
            total: { type: Number },
            originalTotal: { type: Number },
            appliedOfferType: { type: String },
            appliedOfferAmount: { type: Number },
            offerDetails: [
                {
                    type: { type: String }, // 'Product' or 'Category'
                    description: { type: String },
                    discountPercentage: { type: Number },
                    discountAmount: { type: Number },
                },
            ],
        },
    ],
    subTotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    couponDiscount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
});

module.exports = mongoose.model('Cart', cartSchema);
