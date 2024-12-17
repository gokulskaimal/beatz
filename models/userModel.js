const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  googleId: { type: String },
  password: { type: String },
  isBlocked: { type: Boolean, required: true, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

