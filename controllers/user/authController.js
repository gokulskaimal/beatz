const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../../models/userModel');
const { sendEmail } = require('../../utils/sendEmail');

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
    return res.render('pages/signup', {
      title: 'Signup',
      message: 'Passwords do not match.',
    });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        // User signed up with Google
        return res.render('pages/signup', {
          title: 'Signup',
          message: 'This email is already linked to a Google account. Please log in.',
        });
      }

      // Email already registered manually
      return res.render('pages/signup', {
        title: 'Signup',
        message: 'An account with this email already exists. Try logging in.',
      });
    }

    // Generate OTP for new user
    await sendOtp(email, 'Your Signup OTP');
    req.session.tempUser = { firstName, lastName, email, phone, password };
    res.redirect('/auth/verify-otp?message=OTP sent successfully');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).render('pages/signup', {
      title: 'Signup',
      message: 'Internal server error. Please try again later.',
    });
  }
};

// Render OTP verification page
exports.getVerifyOtpPage = (req, res) => {
  console.log( req.session.tempUser)
    if (!req.session.tempUser) {
        return res.redirect('/auth/signup'); // Redirect if tempUser is missing
    }
    res.render('pages/verifyOtp', {
        title: 'Verify OTP',
        tempUser: req.session.tempUser, // Pass tempUser to the EJS file
        message: req.query.message || null,
    });
};

// Step 2: Verify OTP and complete signup
exports.verifyOtp = async (req, res) => { 
  const { otp } = req.body;
  const email = req.session.tempUser?.email;

  if (!email || !otpStore[email]) {
    return res.render('pages/verifyOtp', {
      title: 'Verify OTP',
      message: 'OTP expired or invalid.',
    });
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.render('pages/verifyOtp', {
      title: 'Verify OTP',
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
      isBlocked: false,
    });

    await newUser.save();
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    };

    // Clear OTP and temporary session data
    delete otpStore[email];
    req.session.tempUser = null;

    res.redirect('/user/home?message=OTP verified successfully. Account created!');
  } catch (error) {
    console.error('Error during user creation:', error);
    res.status(500).render('pages/verifyOtp', {
      title: 'Verify OTP',
      message: 'Internal server error. Please try again later.',
    });
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
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    res.redirect('/user/home?message=Login successful');
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).render('pages/login', {
      title: 'Login',
      message: 'Internal server error. Please try again later.',
    });
  }
};

// Handle user logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login?message=Logged out successfully');
  });
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
      return res.render('pages/forgotPassword', {
        title: 'Forgot Password',
        message: 'No account found with this email.',
      });
    }

    // Generate OTP and store it temporarily
    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    // Send OTP via email
    await sendEmail(email, 'Your Password Reset OTP', `Your OTP is ${otp}`);
    console.log(`Generated OTP for ${email}: ${otp}`);

    req.session.tempEmail = email; // Store email in session
    res.redirect('/auth/verify-otp-reset?message=OTP sent successfully');
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).render('pages/forgotPassword', {
      title: 'Forgot Password',
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
    return res.render('pages/verifyOtpReset', {
      title: 'Verify OTP',
      message: 'OTP expired or invalid.',
    });
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.render('pages/verifyOtpReset', {
      title: 'Verify OTP',
      message: 'Invalid or expired OTP.',
    });
  }

  // OTP verified successfully, proceed to reset password
  req.session.isOtpVerified = true;
  res.redirect('/auth/reset-password?message=OTP verified successfully');
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
    return res.redirect('/auth/forgot-password');
  }

  if (password !== confirmPassword) {
    return res.render('pages/resetPassword', {
      title: 'Reset Password',
      message: 'Passwords do not match.',
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('pages/resetPassword', {
        title: 'Reset Password',
        message: 'Invalid session. Please try again.',
      });
    }

    // Hash and update the new password
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    // Clear session and OTP store
    delete otpStore[email];
    req.session.tempEmail = null;
    req.session.isOtpVerified = null;

    res.redirect('/auth/login?message=Password changed successfully');
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).render('pages/resetPassword', {
      title: 'Reset Password',
      message: 'Internal server error. Please try again later.',
    });
  }
};


exports.resendOtp = async (req, res) => {
  const email = req.session.tempEmail;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Session expired or email not found. Please try again.',
      });
    }

    // Generate a new OTP
    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    // Send OTP via email
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

