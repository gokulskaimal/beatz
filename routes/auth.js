const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login and signup pages
router.get('/login', authController.getLoginPage);
router.get('/signup', authController.getSignupPage);

// Signup flow
router.post('/signup', authController.postSignup);
router.get('/verify-otp', (req, res) => {
  res.render('pages/verifyOtp', {
    title: 'Verify OTP',
    tempUser: req.session.tempUser, // Pass tempUser to the EJS view
  });
});
router.post('/verify-otp', authController.verifyOtp);

// Resend OTP
router.post('/resend-otp', authController.resendOtp);

// Login flow
router.post('/login', authController.postLogin); 

module.exports = router;
 