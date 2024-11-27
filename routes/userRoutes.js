const express = require('express')
const router = express.Router();;
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController')
const passController = require('../controllers/passController')
const userAuth = require('../middlewares/userAuth');
const cartController= require('../controllers/cartController')
const viewController = require('../controllers/allProducts')


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
router.get('/allProducts',userAuth.checkSession,viewController.getAllProducts)




module.exports = router;
