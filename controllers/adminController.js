const Admin = require('../models/adminModel');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');

exports.getLoginPage = (req, res) => {
  res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      req.session.isAdmin = true; // Set session
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: 'Invalid email or password' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.getDashboard = (req, res) => {
  res.render('admin/dashboard');
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

// Get Users with Pagination and Search
exports.getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    const query = search
      ? { $or: [{ firstName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};

    const users = await User.find(query).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      users,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// Block User
exports.blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = true;
    await user.save();
    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error blocking user' });
  }
};

// Unblock User
exports.unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = false;
    await user.save();
    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error unblocking user' });
  }
};


const Category = require("../models/categoryModel");

// Fetch Categories with Pagination
exports.getCategories = async (req, res) => {
  try {
    const { skip, limit, currentPage } = req.pagination;

    const [categories, totalCategories] = await Promise.all([
      Category.find().sort({ addedOn: -1 }).skip(skip).limit(limit),
      Category.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render('admin/categories', { categories, currentPage, totalPages });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send('Internal Server Error');
  }
};


// Add a New Category
exports.addCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    console.log("ghjkkjhgvcvbnm")

    if (!name || !status) {
      return res.status(400).json({ success: false, message: "Category name and status are required" });
    }

    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const newCategory = new Category({ name, description, status });
    await newCategory.save();

    res.status(201).json({ success: true, message: "Category added successfully" });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.checkDuplicateCategory = async (req, res) => {
  try {
    const { name } = req.query;
    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res.json({ success: false, message: 'Category name already exists.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error checking duplicate category:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




// Activate a Category
exports.activateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.isActive = true;
    await category.save();

    res.status(200).json({ success: true, message: "Category activated successfully" });
  } catch (error) {
    console.error("Error activating category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Deactivate a Category
exports.deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.isActive = false;
    await category.save();

    res.status(200).json({ success: true, message: "Category deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Edit a Category
exports.editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name , description , status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    let category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    category = await Category.findByIdAndUpdate(id, {
      name,
      description,
      status
  }, { new: true });

    res.status(200).json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    console.error("Error editing category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
exports.softDeleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { status: 'inactive' });
    res.json({ success: true, message: 'Category has been successfully deactivated.' });
  } catch (err) {
    console.error("Error deactivating category:", err);
    res.status(500).json({ success: false, message: 'Failed to deactivate category.' });
  }
};




const Product = require('../models/productModel');

exports.getProducts = async (req, res) => {
  try {
    const perPage = 10; // Products per page
    const currentPage = parseInt(req.query.page) || 1;

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find()
      .populate('category') // Get category name
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.render('admin/products', { products, totalPages, currentPage });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
