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




const validateProductInput = (data) => {
  const errors = [];

  // Validate product name (only letters and spaces, 3-50 characters)
  if (!/^[a-zA-Z\s]{3,50}$/.test(data.product_name)) {
    errors.push('Product name must be 3-50 characters long and contain only letters and spaces.');
  }

  // Validate description (minimum 10 characters)
  if (!data.description || data.description.length < 10) {
    errors.push('Description must be at least 10 characters long.');
  }

  // Validate category (valid MongoDB ObjectId)
  if (!mongoose.Types.ObjectId.isValid(data.category)) {
    errors.push('Invalid category ID.');
  }

  // Validate price (positive number with up to 2 decimal places)
  if (!/^\d+(\.\d{1,2})?$/.test(data.price) || parseFloat(data.price) <= 0) {
    errors.push('Price must be a positive number with up to 2 decimal places.');
  }

  // Validate stock (non-negative integer)
  if (!/^\d+$/.test(data.stock) || parseInt(data.stock) < 0) {
    errors.push('Stock must be a non-negative integer.');
  }

  // Validate brand (letters and spaces, 2-30 characters)
  if (!/^[a-zA-Z\s]{2,30}$/.test(data.brand)) {
    errors.push('Brand must be 2-30 characters long and contain only letters and spaces.');
  }

  // Validate type (alphanumeric, 3-20 characters)
  if (!/^[a-zA-Z0-9\s]{3,20}$/.test(data.type)) {
    errors.push('Type must be 3-20 characters long and alphanumeric.');
  }

  // Validate color (letters only, 3-20 characters)
  if (!/^[a-zA-Z\s]{3,20}$/.test(data.color)) {
    errors.push('Color must be 3-20 characters long and contain only letters.');
  }

  // Validate warranty (positive integer)
  if (!/^\d+$/.test(data.warranty) || parseInt(data.warranty) <= 0) {
    errors.push('Warranty must be a positive integer.');
  }

  // Validate discount (0-100%)
  if (!/^\d+(\.\d{1,2})?$/.test(data.discount) || data.discount < 0 || data.discount > 100) {
    errors.push('Discount must be a number between 0 and 100.');
  }

  // Validate rating (0-5, up to 1 decimal place)
  if (!/^[0-5](\.\d{1})?$/.test(data.rating) || data.rating < 0 || data.rating > 5) {
    errors.push('Rating must be a number between 0 and 5 with up to 1 decimal place.');
  }

  return errors;
};


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


    const totalProducts = await Product.countDocuments();
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

    try {
      const errors = validateProductInput(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }
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
      const errors = validateProductInput(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }
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
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting product', error: err.message });
  }
};


