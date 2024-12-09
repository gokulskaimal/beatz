const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../../utils/cloudinary');
const mongoose = require("mongoose");

// Set up Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const upload = multer({ storage: storage });

// Get all products with pagination
exports.getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    let products = await Product.find()
      .skip(skip)
      .limit(limit)
      .populate('category');

    products = products.filter(product => {
      return product.category.status === "Active" && !product.isBlocked;
    });

    const totalProducts = await Product.countDocuments({
      'category.status': 'Active',
      isBlocked: false
    });
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));

    const categories = await Category.find();

    res.render('admin/products', {
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      itemsPerPage: limit,
      message: null 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'An error occurred while fetching products.' });
  }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.render('user/product', { product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Add a new product
exports.addProduct = [
  upload.array('product_images', 3),
  async (req, res) => {
    const { 
      product_name, 
      description, 
      category, 
      price,  
      stock, 
     brand, 
      type, 
      color, 
      warranty,
      discount,
      rating 
    } = req.body;
    console.log(req.body)
    try {
      // Strict validation
      if (!product_name || !description || !category || !price || !stock || !brand || !type || !color || !warranty ||!rating || req.files.length < 3) {
        return res.status(400).json({ success: false, message: 'All fields are required and at least 3 images must be uploaded.' });
      }

      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
      }

      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a non-negative number.' });
      }

      if (isNaN(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({ success: false, message: 'Discount must be a number between 0 and 100.' });
      }
      const images = req.files.map(file => file.path);
      const discountPrice = price * (1 - discount / 100);
      console.log(discountPrice)
      const product = new Product({
        product_name,
        description,
        category,
        image: images,
        price: parseFloat(price),
        stock: parseInt(stock),
        specifications: {
         brand,
          type,
          color,
          warranty
        },
        discount: parseFloat(discount) || 0,
        rating:parseFloat(rating) || 0,
        discountPrice: parseFloat(discountPrice)
      });

      await product.save();
      res.status(201).json({ success: true, message: 'Product added successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to add product', error: err.message });
    }
  }
];

// Update a product
exports.updateProduct = [
  upload.array('product_images', 3),
  async (req, res) => {
    const { 
      product_name, 
      description, 
      category, 
      price, 
      stock, 
      brand, 
      type, 
      color, 
      warranty,
      discount,
      rating 
    } = req.body;

    try {
      // Strict validation
      if (!product_name || !description || !category || !price || !stock || !brand || !type || !color || !warranty ||!rating) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }

      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
      }

      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a non-negative number.' });
      }

      if (isNaN(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({ success: false, message: 'Discount must be a number between 0 and 100.' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }
      const discountPrice = price * (1 - discount / 100);
      const updateData = {
        product_name,
        description,
        category,
        price: parseFloat(price),
        stock: parseInt(stock),
        specifications: {
         brand,
          type,
          color,
          warranty
        },
        discount: parseFloat(discount) || 0,
        rating:parseFloat(rating) || 0,
        discountPrice: parseFloat(discountPrice)
      };

      if (req.files && req.files.length > 0) {
        updateData.image = req.files.map(file => file.path);
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      return res.json({ success: true, message: 'Product updated successfully', product });

    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to update product', error: err.message });
    }
  }
];

// Block a product
exports.blockProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product blocked successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error blocking product', error: err.message });
  }
};

// Unblock a product
exports.unblockProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product unblocked successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error unblocking product', error: err.message });
  }
};

// Soft delete a product
exports.softDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error soft deleting product', error: err.message });
  }
};

