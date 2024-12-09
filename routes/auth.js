const express = require('express');
const router = express.Router();
const authController = require('../controllers/user/authController');
const passport = require('passport');
const userAuth = require('../middlewares/userAuth');


// Google OAuth Login
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  (req, res) => {
    req.session.user = req.user;

    // Successful authentication
    res.redirect('/user/home');
  }
);

// Login and signup pages
router.get('/login', userAuth.isLogin, authController.getLoginPage);
router.get('/signup', userAuth.isLogin, authController.getSignupPage);

// Signup flow
router.post('/signup', userAuth.isLogin, authController.postSignup);
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
router.post('/login', userAuth.isLogin, authController.postLogin);
router.get("/logout", authController.logout)


// Forgot Password
router.get('/forgot-password', authController.getForgotPasswordPage);
router.post('/forgot-password', authController.handleForgotPassword);

// Verify OTP and Reset Password
router.get('/verify-otp-reset', authController.getVerifyOtpResetPage);
router.post('/verify-otp-reset', authController.verifyOtpReset);
router.get('/reset-password', authController.getResetPasswordPage);
router.post('/reset-password', authController.resetPassword)
router.post('/reset-resend-otp', authController.resendOtp);


router.get('/home',authController.getHome)
router.get('/allProducts', authController.getAllProducts);
router.get('/product/:id', authController.getProduct);

module.exports = router;