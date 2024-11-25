const express = require('express');
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController')
const router = express.Router();
const userAuth = require('../middlewares/userAuth');

// Routes
router.get("/home", userAuth.checkSession, userController.getHome);
router.get("/product/:productId", userAuth.checkSession, userController.getProduct);
router.get('/profile', userAuth.checkSession, userController.getProfile);
router.post('/profile/update', userAuth.checkSession, userController.updateProfile);


router.get('/address', userAuth.checkSession, addressController.getAddresses);
router.post('/address/add', userAuth.checkSession, addressController.addAddress);
router.post('/address/edit/:addressId', userAuth.checkSession, addressController.editAddress);
router.post('/address/delete/:addressId', userAuth.checkSession, addressController.deleteAddress);



module.exports = router;
