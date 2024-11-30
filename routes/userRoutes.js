const express = require('express')
const router = express.Router();;
const userController = require('../controllers/user/userController');
const addressController = require('../controllers/user/addressController')
const passController = require('../controllers/user/passController')
const userAuth = require('../middlewares/userAuth');
const cartController= require('../controllers/user/cartController')
const allProductsController = require('../controllers/user/allProductsController')
const checkoutController = require('../controllers/user/checkoutController') 
const orderController = require('../controllers/user/orderController');


//Personal Info
router.get("/home", userAuth.checkSession, userController.getHome);
router.get("/product/:productId", userAuth.checkSession, userController.getProduct);
router.get('/profile', userAuth.checkSession, userController.getProfile);
router.post('/profile/update', userAuth.checkSession, userController.updateProfile);

//Address
router.get('/address', userAuth.checkSession, addressController.getAddresses);
router.post('/address/add', userAuth.checkSession, addressController.addAddress);
router.post('/address/edit/:addressId', userAuth.checkSession, addressController.editAddress);
router.post('/address/delete/:addressId', userAuth.checkSession, addressController.deleteAddress);

//Change Password
router.get('/changePassword', userAuth.checkSession,passController.getChangePasswordPage)
router.post('/changePassword', userAuth.checkSession, passController.postChangePassword);

//Cart
router.get('/cart',userAuth.checkSession,cartController.getCart)
router.post('/cart/add',userAuth.checkSession,cartController.addToCart)
router.post('/cart/update',userAuth.checkSession,cartController.updateQuantity)
router.post('/cart/remove',userAuth.checkSession,cartController.removeFromCart)

//View All

router.get('/allProducts',userAuth.checkSession,allProductsController.getAllProducts)

//Orders
router.get('/checkout',userAuth.checkSession,checkoutController.getCheckout)
router.post('/place-order', userAuth.checkSession, orderController.placeOrder);
router.get('/confirmation/:orderId', userAuth.checkSession, orderController.getOrderConfirmation);
router.get('/myOrders', userAuth.checkSession, orderController.getUserOrders);
router.get('/order/details/:orderId', userAuth.checkSession, orderController.getOrderDetails);
router.post('/order/cancel/:orderId', userAuth.checkSession, orderController.cancelOrder);

module.exports = router;
