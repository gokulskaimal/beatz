const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    status: { type: String, required: true, enum: ['active', 'inactive'] },
},{ timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
