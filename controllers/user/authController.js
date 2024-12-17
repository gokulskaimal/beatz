const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../../models/userModel');
const { sendEmail } = require('../../utils/sendEmail');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');

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
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match.',
    });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        return res.status(400).json({
          success: false,
          message: 'This email is already linked to a Google account. Please log in.',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Try logging in.',
      });
    }

    await sendOtp(email, 'Your Signup OTP');
    req.session.tempUser = { firstName, lastName, email, phone, password };
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      redirectUrl: '/auth/verify-otp',
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
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
    message: req.query.message || null,
  });
};
exports.verifyOtp = async (req, res) => {
  const { otp } = req.body;
  const email = req.session.tempUser?.email;

  if (!email || !otpStore[email]) {
    return res.status(400).json({
      success: false,
      message: 'OTP expired or invalid.',
    });
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP.',
    });
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

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. Account created!',
      redirectUrl: '/user/home',
    });
  } catch (error) {
    console.error('Error during user creation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};


// Handle user login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Contact support.',
      });
    }

    req.session.user = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      redirectUrl: '/user/home',
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};



// Handle user logout
exports.logout = (req, res) => {
  if (req.session.user) {
    delete req.session.user;
    res.redirect('/auth/login?message=Logged out successfully');
  } else {
    res.redirect('/auth/login?message=No active session to log out');
  }
};

// Render Forgot Password Page
exports.getForgotPasswordPage = (req, res) => {
  res.render('pages/forgotPassword', {
    title: 'Forgot Password',
    message: null,
  });
};

// Handle Forgot Password Request (Generate OTP)
exports.handleForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    await sendEmail(email, 'Your Password Reset OTP', `Your OTP is ${otp}`);
    console.log(`Generated OTP for ${email}: ${otp}`);

    req.session.tempEmail = email;
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      redirectUrl: '/auth/verify-otp-reset',
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};

// Render Verify OTP Page
exports.getVerifyOtpResetPage = (req, res) => {
  if (!req.session.tempEmail) {
    return res.redirect('/auth/forgot-password');
  }
  res.render('pages/verifyOtpReset', {
    title: 'Verify OTP',
    message: null,
  });
};

// Verify OTP
exports.verifyOtpReset = (req, res) => {
  const { otp } = req.body;
  const email = req.session.tempEmail;

  if (!email || !otpStore[email]) {
    return res.status(400).json({
      success: false,
      message: 'OTP expired or invalid.',
    });
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP.',
    });
  }

  req.session.isOtpVerified = true;
  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    redirectUrl: '/auth/reset-password',
  });
};

exports.resendOtpReset = async (req, res) => {
  const email = req.session.tempEmail;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email not found in session. Please try again.',
    });
  }

  try {
    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    await sendEmail(email, 'Your Password Reset OTP', `Your new OTP is ${otp}`);
    console.log(`New OTP sent to ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully. Please check your email.',
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.',
    });
  }
};


// Render Reset Password Page
exports.getResetPasswordPage = (req, res) => {
  if (!req.session.isOtpVerified) {
    return res.redirect('/auth/forgot-password');
  }
  res.render('pages/resetPassword', {
    title: 'Reset Password',
    message: null,
  });
};

// Handle Password Reset
exports.resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const email = req.session.tempEmail;

  if (!email || !req.session.isOtpVerified) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session. Please start the password reset process again.',
      redirectUrl: '/auth/forgot-password'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match.',
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please try again.',
        redirectUrl: '/auth/forgot-password'
      });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    delete otpStore[email];
    req.session.tempEmail = null;
    req.session.isOtpVerified = null;

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      redirectUrl: '/auth/login'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};



exports.resendOtp = async (req, res) => {
  const email = req.session?.tempUser?.email || req.session?.tempEmail;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Session expired or email not found. Please try again.',
    });
  }

  try {
    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    await sendEmail(email, 'Your New OTP', `Your OTP is ${otp}`);
    console.log(`New OTP sent to ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully. Please check your email.',
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.',
    });
  }
};

// Home, all products, and product page

exports.getHome = async (req, res) => {
  try {
    const perPage = 10; 
    const currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find()
      .populate('category')
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.render('pages/authHome', { products, message: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.getAllProducts = async (req, res) => {
  const { search, category, minPrice, maxPrice, rating, sort, page = 1 } = req.query;
  
  let filter = {};
  if (search) filter.product_name = { $regex: search, $options: 'i' };
  if (category) filter.category = category;
  if (minPrice) filter.discountPrice = { $gte: parseFloat(minPrice) };
  if (maxPrice) filter.discountPrice = { $lte: parseFloat(maxPrice) };
  if (rating) filter.rating = { $gte: parseFloat(rating) };

  const sortOptions = {
    newest: { createdAt: -1 },
    price_asc: { discountPrice: 1 },
    price_desc: { discountPrice: -1 },
    rating: { rating: -1 },
  };

  const products = await Product.find(filter)
    .sort(sortOptions[sort] || sortOptions.newest)
    .skip((page - 1) * 9)
    .limit(9);

  const totalProducts = await Product.countDocuments(filter);
  const totalPages = Math.ceil(totalProducts / 9);

  const categories = await Category.find();

  if (req.xhr) {
    return res.json({ products, totalPages, currentPage: parseInt(page) });
  }

  res.render('pages/authAllProducts', {
    products,
    categories,
    search,
    category,
    minPrice,
    maxPrice,
    rating,
    sort,
    totalPages,
    currentPage: parseInt(page),
  });
};

// Fetch Product Details
exports.getProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).render('pages/authProduct', { product: {}, similarProducts: [], message: 'Product not found' });
    }
    const similarProducts = await Product.find({ category: product.category }).limit(2);
    res.render('pages/authProduct', { product, similarProducts, message: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

