const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    street: {
        type: String,
        required: true,
        trim: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        trim: true,
    },
    zipCode: {
        type: String,
        required: true,
        trim: true,
    },
    country: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        validate: {
            validator: function (value) {
                return /^[0-9]{10,15}$/.test(value); // Validate phone number
            },
            message: 'Invalid phone number',
        },
    },
}, { timestamps: true });

module.exports = mongoose.model('Address', addressSchema);
