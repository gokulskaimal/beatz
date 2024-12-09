const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    status: { type: String, required: true, enum: ['Active', 'InActive'] },
},{ timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
