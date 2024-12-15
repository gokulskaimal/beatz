const express = require('express');
const router = express.Router();
const adminAuth = require("../middlewares/adminAuth");
const adminController = require('../controllers/admin/adminController');
const productController = require('../controllers/admin/productController');
const categoryController = require('../controllers/admin/categoryController');
const adminOrderController = require('../controllers/admin/adminOrderController');
const adminCouponsController = require('../controllers/admin/adminCouponsController');
const adminOfferController = require('../controllers/admin/adminOfferController');
const salesController = require('../controllers/admin/salesController');


// Admin Authentication Routes
router.get('/login',adminAuth.isLogin, adminController.getLoginPage);
router.post('/login', adminController.postLogin);
router.get('/logout', adminAuth.checkSession, adminController.logout);
 
// Dashboard Route
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/sales', adminController.getSalesData);
router.get('/dashboard/best-selling/:type', adminController.getBestSelling);



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
router.put("/categories/:id",adminAuth.checkSession, categoryController.editCategory); 
router.delete('/categories/:id',adminAuth.checkSession, categoryController.softDeleteCategory);



// Product Management Routes
router.get('/products',adminAuth.checkSession, productController.getAllProducts); 
router.get('/products/:id',adminAuth.checkSession, productController.getProductById);
// router.put('/products/:id', productController.updateProduct); // Update a product
router.put('/products/block/:id',adminAuth.checkSession, productController.blockProduct); 
router.put('/products/unblock/:id',adminAuth.checkSession, productController.unblockProduct); 
router.delete('/products/:id',adminAuth.checkSession, productController.deleteProduct);
router.post('/products',adminAuth.checkSession,  productController.addProduct);
router.put('/products/:id',adminAuth.checkSession,  productController.updateProduct);  

//Orders Management
router.get('/orders', adminAuth.checkSession, adminOrderController.getOrders);
router.get('/orders/:orderId', adminAuth.checkSession, adminOrderController.getOrderDetails);
router.put('/orders/:orderId/status', adminAuth.checkSession, adminOrderController.updateOrderStatus);
router.post('/orders/return-request', adminAuth.checkSession, adminOrderController.handleReturnRequest);

// Coupon routes
router.get('/coupons',  adminAuth.checkSession, adminCouponsController.getCoupons);
router.post('/coupons',  adminAuth.checkSession, adminCouponsController.addCoupon);
router.put('/coupons/:id',  adminAuth.checkSession, adminCouponsController.updateCoupon);
router.delete('/coupons/:id',  adminAuth.checkSession, adminCouponsController.deleteCoupon);
router.get('/coupons/search', adminAuth.checkSession, adminCouponsController.searchCoupons);

// Offer routes
router.get('/offers', adminAuth.checkSession, adminOfferController.getAllOffers);
router.post('/offers',  adminAuth.checkSession, adminOfferController.createOffer);
router.put('/offers/:id',  adminAuth.checkSession, adminOfferController.updateOffer);
router.delete('/offers/:id',  adminAuth.checkSession, adminOfferController.deleteOffer);

//Sales routes
router.get('/sales-report', adminAuth.checkSession, salesController.renderSalesReportPage);
router.get('/sales-report/data', adminAuth.checkSession, salesController.getSalesReport);
router.get('/sales-report/download/pdf', adminAuth.checkSession, salesController.downloadPdfReport);
router.get('/sales-report/download/excel', adminAuth.checkSession, salesController.downloadExcelReport);


module.exports = router;

