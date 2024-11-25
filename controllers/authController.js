const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/userModel');
const { sendEmail } = require('../utils/sendEmail');

// Store OTPs in memory (for simplicity in development)
const otpStore = {};

// Utility function to send OTP
const sendOtp = async (email, subject) => {
  const otp = crypto.randomInt(100000, 999999);
  otpStore[email] = { otp, timestamp: Date.now() };

  await sendEmail(email, subject, `Your OTP is ${otp}`);
  console.log(`Generated OTP for ${email}: ${otp}`);
};

// Render login page
exports.getLoginPage = (req, res) => {
  res.render('pages/login', { title: 'Login', message: null });
};

// Render signup page
exports.getSignupPage = (req, res) => {
  res.render('pages/signup', { title: 'Signup', message: null });
};

// Step 1: Generate OTP and send email
exports.postSignup = async (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render('pages/signup', { title: 'Signup', message: 'Passwords do not match.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('pages/signup', { title: 'Signup', message: 'User already exists.' });
    }

    await sendOtp(email, 'Your Signup OTP');

    req.session.tempUser = { firstName, lastName, email, phone, password };
    res.redirect('/auth/verify-otp');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).render('pages/signup', { title: 'Signup', message: 'Internal server error. Please try again later.' });
  }
};

// Render OTP verification page
exports.getVerifyOtpPage = (req, res) => {
  if (!req.session.tempUser) {
    return res.redirect('/auth/signup');
  }
  res.render('pages/verifyOtp', { 
    title: 'Verify OTP', 
    tempUser: req.session.tempUser,
    message: req.query.message || null
  });
};

// Step 2: Verify OTP and complete signup
exports.verifyOtp = async (req, res) => {
  const { otp } = req.body;
  const email = req.session.tempUser?.email;

  if (!otpStore[email]) {
    return res.render('pages/verifyOtp', { title: 'Verify OTP', message: 'OTP expired or invalid.' });
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.render('pages/verifyOtp', { title: 'Verify OTP', message: 'Invalid or expired OTP.' });
  }

  try {
    const { firstName, lastName, phone, password } = req.session.tempUser;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      isBlocked: false,
    });

    await newUser.save();
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    };

    delete otpStore[email];
    req.session.tempUser = null;

    res.redirect('/user/home');
  } catch (error) {
    console.error('Error during user creation:', error);
    res.status(500).render('pages/verifyOtp', { title: 'Verify OTP', message: 'Internal server error. Please try again later.' });
  }
};

// Resend OTP
exports.resendOtp = async (req, res) => {
  const email = req.session.tempUser?.email;

  try {
    if (!email) {
      return res.redirect('/auth/signup');
    }

    await sendOtp(email, 'Your New OTP');
    res.redirect('/auth/verify-otp?message=OTP resent successfully');
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).redirect('/auth/verify-otp?message=Failed to resend OTP. Please try again later.');
  }
};

// Handle user login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('pages/login', {
        title: 'Login',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('pages/login', {
        title: 'Login',
        message: 'Invalid email or password.',
      });
    }

    if (user.isBlocked) {
      return res.render('pages/login', {
        title: 'Login',
        message: 'Your account is blocked. Contact support.',
      });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    res.redirect('/user/home');
  } catch (error) { 
    console.error('Error during login:', error);
    res.status(500).render('pages/login', {
      title: 'Login',
      message: 'Internal server error. Please try again later.',
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login');
  });
};