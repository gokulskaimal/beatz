// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config(); // Load environment variables from .env

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Your Cloudinary cloud name
  api_key: process.env.CLOUDINARY_API_KEY,      // Your Cloudinary API key
  api_secret: process.env.CLOUDINARY_API_SECRET // Your Cloudinary API secret
});

module.exports = cloudinary;
           