const express = require('express');
const adminController = require('../controllers/adminController');
const router = express.Router();
const adminAuth = require("../middlewares/adminAuth");
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController')

// Admin Authentication Routes
router.get('/login',adminAuth.isLogin, adminController.getLoginPage);
router.post('/login', adminController.postLogin);
router.get('/logout', adminAuth.checkSession, adminController.logout);
 
// Dashboard Route
router.get('/dashboard', adminAuth.checkSession, adminController.getDashboard);

// User Management Routes
router.get('/users', adminAuth.checkSession, adminController.getUsers);
router.put('/users/block/:id',adminAuth.checkSession, adminController.blockUser);
router.put('/users/unblock/:id', adminAuth.checkSession, adminController.unblockUser);
 

// Category Routes
const paginate = require('../middlewares/paginate');

router.get('/categories', adminAuth.checkSession, paginate, categoryController.getCategories);
router.get('/categories/check-duplicate',adminAuth.checkSession,  categoryController.checkDuplicateCategory);


router.post("/categories/",adminAuth.checkSession, categoryController.addCategory);
router.put("/categories/activate/:id",adminAuth.checkSession, categoryController.activateCategory);
router.put("/categories/deactivate/:id",adminAuth.checkSession, categoryController.deactivateCategory);
router.put("/categories/:id",adminAuth.checkSession, categoryController.editCategory); // Edit category route
router.delete('/categories/:id',adminAuth.checkSession, categoryController.softDeleteCategory);
 // Soft delete route


// Product Management Routes
router.get('/products',adminAuth.checkSession, productController.getAllProducts); // Get all products with pagination
router.get('/products/:id',adminAuth.checkSession, productController.getProductById); // Get a single product by ID
// router.put('/products/:id', productController.updateProduct); // Update a product
router.put('/products/block/:id',adminAuth.checkSession, productController.blockProduct); // Block a product
router.put('/products/unblock/:id',adminAuth.checkSession, productController.unblockProduct); // Unblock a product
router.delete('/products/:id',adminAuth.checkSession, productController.softDeleteProduct); // Soft delete a product
// Add the upload middleware to the POST route for products
router.post('/products',adminAuth.checkSession,  productController.addProduct);
router.put('/products/:id',adminAuth.checkSession,  productController.updateProduct);  // Upload up to 5 images


const Category = require('../models/categoryModel'); // Your category schema



module.exports = router;

