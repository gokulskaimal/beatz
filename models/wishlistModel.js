const mongoose=require('mongoose');
const User=require('../models/userModel');
const Product=require('../models/productModel')
const wishlistSchema= new mongoose.Schema({
  userId:{
    type: mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true ,

  },
  productId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Product',
    required:true
  },
},{ timestamps: true })
module.exports=mongoose.model('Wishlist',wishlistSchema);