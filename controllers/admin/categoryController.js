const Category = require("../../models/categoryModel");

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

exports.addCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    if (!name || !status) {
      return res.status(400).json({ success: false, message: "Category name and status are required" });
    }

    const categoryExists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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
    const categoryExists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (categoryExists) {
      return res.json({ success: false, message: 'Category name already exists.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error checking duplicate category:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.activateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.status = 'Active';
    await category.save();

    res.status(200).json({ success: true, message: "Category activated successfully" });
  } catch (error) {
    console.error("Error activating category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.status = 'InActive';
    await category.save();

    res.status(200).json({ success: true, message: "Category deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    if (!name || !status) {
      return res.status(400).json({ success: false, message: "Category name and status are required" });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const categoryExists = await Category.findOne({ 
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: "Category name already exists" });
    }

    category.name = name;
    category.description = description;
    category.status = status;
    await category.save();

    res.status(200).json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    console.error("Error editing category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.softDeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.status = 'InActive';
    await category.save();

    res.json({ success: true, message: 'Category has been successfully deactivated.' });
  } catch (err) {
    console.error("Error deactivating category:", err);
    res.status(500).json({ success: false, message: 'Failed to deactivate category.' });
  }
};