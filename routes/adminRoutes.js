const express = require('express');
const adminController = require('../controllers/adminController');
const router = express.Router();

// Middleware to protect admin routes
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
};

// Admin Authentication Routes
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

// Dashboard Route
router.get('/dashboard', isAdmin, adminController.getDashboard);

// User Management Routes
router.get('/users', isAdmin, adminController.getUsers);
router.put('/users/block/:id', isAdmin, adminController.blockUser);
router.put('/users/unblock/:id', isAdmin, adminController.unblockUser);
 


// Configure Multer for image upload
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify your upload directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Rename the file
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).fields([{ name: 'product_images', maxCount: 3 }]); // Ensure the field name matches








// Category Routes
// Category Routes
const paginate = require('../middlewares/paginate');

router.get('/categories', isAdmin, paginate, adminController.getCategories);
router.get('/categories/check-duplicate', isAdmin, adminController.checkDuplicateCategory);


router.post("/categories/", adminController.addCategory);
router.put("/categories/activate/:id", adminController.activateCategory);
router.put("/categories/deactivate/:id", adminController.deactivateCategory);
router.post("/categories/:id", adminController.editCategory); // Edit category route
router.delete('/categories/:id', adminController.softDeleteCategory);
 // Soft delete route
;

//Products Routes
const productController = require('../controllers/productController');

// Product Management Routes
router.get('/products', productController.getAllProducts); // Get all products with pagination
router.get('/products/:id', productController.getProductById); // Get a single product by ID
// router.put('/products/:id', productController.updateProduct); // Update a product
router.put('/products/block/:id', productController.blockProduct); // Block a product
router.put('/products/unblock/:id', productController.unblockProduct); // Unblock a product
router.delete('/products/:id', productController.softDeleteProduct); // Soft delete a product
// Add the upload middleware to the POST route for products
router.post('/products', upload, productController.addProduct);
router.put('/products/edit/:id', upload,  productController.updateProduct);  // Upload up to 5 images


const Category = require('../models/categoryModel'); // Your category schema

// Render Categories Page  
// Fetch a single category by ID 

// Add Category
router.post('/categories/add', async (req, res) => {
  try {
      const { name, description, status } = req.body;
      
      // Validate inputs
      if (!name || !status) {
          return res.status(400).json({ success: false, message: 'Name and status are required' });
      }

      // Save to the database
      const newCategory = new Category({ name, description, status });
      await newCategory.save();

      res.redirect('/admin/categories'); // Redirect back to the categories page
  } catch (err) {
      console.error(err);
      res.status(500).send('Failed to add category');
  }
});




// Delete Category
router.delete('/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Category deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});



module.exports = router;

