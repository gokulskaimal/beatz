const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const mongoose = require("mongoose")


// Get all products with pagination
exports.getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    // Fetch products with pagination and category details
    const products = await Product.find()
      .skip(skip)
      .limit(limit)
      .populate('category', 'name'); // Populate category name

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch all categories for the category dropdown
    const categories = await Category.find();

    res.render('admin/products', {
      products,
      categories,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
}; 

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.json(product);
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// Add a new product
exports.addProduct = async (req, res) => {
  const { product_name, description, category, price, stock, specifications, variants } = req.body;
  try {
    // Validate required fields
    if (!product_name || !description || !category || !price || !stock || !req.files || req.files.length < 3) {
      return res.status(400).json({ success: false, message: 'All fields are required and at least 3 images must be uploaded.' });
    }

    // Handle multiple images
    const images = req.files.product_images.map(file =>`/uploads/${file.filename}`);
    const product = new Product({ 
      product_name,
      description,
      category,
      image: images,  // Ensure correct field name for images
      price,
      stock,
      specifications,
      variants, // Include variants
    });

    await product.save();
    res.status(201).json({ success: true, message: 'Product added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add product' });
  }
};

 
// Update a product

exports.updateProduct = async (req, res) => {
  
  const { product_name, description, category, price, stock, specifications, variants } = req.body;


  try {
    // Validate required fields
    if (!product_name || !description || !category || !price || !stock) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Handle multiple images if present
    const images = req.files ? req.files.product_images.map(file => `/uploads/${file.filename}`) : [];

    // Check if the product ID is valid
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Update the product in the database
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        product_name,
        description,
        category,
        images, // Array of image paths
        price,
        stock,
        specifications,
        variants, // Include updated variants
      },
      { new: true } // Return the updated document
    );
    

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};


// Block a product
exports.blockProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isBlocked: true });
    res.json({ success: true, message: 'Product blocked successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error blocking product' });
  }
};

// Unblock a product
exports.unblockProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isBlocked: false });
    res.json({ success: true, message: 'Product unblocked successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error unblocking product' });
  }
};

// Soft delete a product
exports.softDeleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {

    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
};
