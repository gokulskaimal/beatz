const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
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
    req.session.user = true;

    // Successful authentication
    res.redirect('/user/home');
  }
);

// Login and signup pages
router.get('/login',userAuth.isLogin, authController.getLoginPage);
router.get('/signup',userAuth.isLogin, authController.getSignupPage);

// Signup flow
router.post('/signup', userAuth.isLogin,authController.postSignup);
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
router.post('/login',userAuth.isLogin, authController.postLogin); 
router.get("/logout",authController.logout)
module.exports = router;
 