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
const wishlistController = require('../controllers/user/wishlistController');
const couponsController = require('../controllers/user/couponController');
const walletController = require('../controllers/user/walletController');


//Personal Info
router.get("/home", userController.getHome);
router.get("/product/:productId", userController.getProduct);
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
router.post('/validate-cart',userAuth.checkSession,checkoutController.validateCart)

//View All
router.get('/allProducts',allProductsController.getAllProducts)

// Checkout routes
router.get('/checkout', userAuth.checkSession, checkoutController.getCheckout);
router.post('/apply-coupon', userAuth.checkSession, checkoutController.applyCoupon);
router.post('/remove-coupon', userAuth.checkSession, checkoutController.removeCoupon);

// Order routes
router.post('/place-order', userAuth.checkSession, orderController.placeOrder);
router.get('/confirmation/:orderId', userAuth.checkSession, orderController.getOrderConfirmation);
router.get('/myOrders', userAuth.checkSession, orderController.getUserOrders);
router.get('/order/details/:orderId', userAuth.checkSession, orderController.getOrderDetails);
router.post('/order/:orderId/cancel/:itemId', userAuth.checkSession, orderController.cancelOrderItem);
router.post('/order/return-request', userAuth.checkSession, orderController.requestReturn);
router.post('/order/verify-payment', userAuth.checkSession, orderController.verifyPayment);
router.get('/order/invoice/:orderId', userAuth.checkSession, orderController.generateInvoice);
router.post('/order/resume-payment/:orderId', userAuth.checkSession, orderController.continuePayment); 
router.post('/order/payment-failed', userAuth.checkSession, orderController.handlePaymentFailure);

// Wallet routes
router.get('/wallet', userAuth.checkSession, walletController.getWallet);
router.post('/wallet/add-funds', userAuth.checkSession, walletController.addFunds);
router.get('/wallet-balance', userAuth.checkSession, orderController.getWalletBalance);


//wishlist
router.get('/wishlist',  userAuth.checkSession, wishlistController.getWishlist);
router.get('/wishlist/data',  userAuth.checkSession, wishlistController.getWishlistData);
router.post('/wishlist/add',  userAuth.checkSession, wishlistController.addToWishlist);
router.post('/wishlist/remove',  userAuth.checkSession, wishlistController.removeFromWishlist);
router.post('/wishlist/toggle',  userAuth.checkSession, wishlistController.toggleWishlistItem);

//coupons
router.get('/coupons', userAuth.checkSession, couponsController.getCoupons)

router.get('*',(req, res, next) => {
    res.status(404).render('pages/404', { title: 'Page Not Found' });
  });

module.exports = router;