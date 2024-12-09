const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  googleId: { type: String, unique: true , sparse: true},
  password: { type: String},
  isBlocked:{ type: Boolean, required: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
 