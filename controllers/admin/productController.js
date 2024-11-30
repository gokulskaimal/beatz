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
    folder: 'products',  // Cloudinary folder for the images
    allowed_formats: ['jpg', 'png', 'jpeg'], // Allowed image formats
    transformation: [{ width: 500, height: 500, crop: 'limit' }]  // Optional: Resize images
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
      .populate('category'); // Populate category name

    products = products.filter(product => {
      if (product.category.status == "Active" && product.isBlocked == false ) {
        return product;
      }
    });

    const totalProducts = await Product.countDocuments();
    const totalPages = totalProducts > 0 ? Math.ceil(totalProducts / limit) : 1;

    const categories = await Category.find();

    res.render('admin/products', {
      products,
      categories,
      currentPage: page,
      totalPages,
      message: null 
    });
  } catch (err) {
    res.status(500).send({ success: false, message: 'An error occurred while fetching products.' });
  }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.render('user/product', { product });
  } catch (err) {
    res.status(500).send('Server Error'); 
  }
};

// Add a new product
exports.addProduct = [
  upload.array('product_images', 3),
  async (req, res) => {
    const { product_name, description, category, price, stock, specifications, variants } = req.body;

    try {
      if (!product_name || !description || !category || !price || !stock || req.files.length < 3) {
        return res.status(400).json({ success: false, message: 'All fields are required and at least 3 images must be uploaded.' });
      }

      // Handle multiple images uploaded to Cloudinary
      const images = req.files.map(file => file.path);
      const product = new Product({
        product_name,
        description,
        category,  // Ensure valid category is passed
        image: images,
        price,
        stock,
        specifications,
        variants,
      });

      await product.save();
      res.status(201).json({ success: true, message: 'Product added successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to add product' });
    }
  }
];

// Update a product
exports.updateProduct = [
  upload.array('product_images', 3),
  async (req, res) => {
    const { product_name, description, category, price, stock, specifications, variants } = req.body;

    try {
      if (!product_name || !description || !category || !price || !stock || req.files.length < 3) {
        return res.status(400).json({ success: false, message: 'All fields are required and at least 3 images must be uploaded.' });
      }

      const images = req.files ? req.files.map(file => file.path) : [];

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        {
          product_name,
          description,
          category, // Use the category directly
          image: images,
          price,
          stock,
          specifications,
          variants,
        },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      return res.json({ success: true, message: 'Product updated successfully', product });

    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  }
];

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
  console.log(req.params.id)
  try {
    await Product.findByIdAndUpdate(req.params.id, {$set:{ isBlocked: true}});
    res.json({ success: true, message: 'Product soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error soft deleting product' });
  }
};
