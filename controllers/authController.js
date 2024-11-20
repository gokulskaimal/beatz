const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/userModel');
const { sendEmail } = require('../utils/sendEmail');

// Store OTPs in memory (for simplicity in development)
const otpStore = {};

// Render login page
exports.getLoginPage = (req, res) => {
  res.render('pages/login', { title: 'Login' });
};

// Render signup page
exports.getSignupPage = (req, res) => {
  res.render('pages/signup', { title: 'Signup' });
};

// Step 1: Generate OTP and send email
exports.postSignup = async (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send('Passwords do not match.');
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User already exists.');
    }

    const otp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp, timestamp: Date.now() };

    await sendEmail(email, 'Your Signup OTP', `Your OTP for signup is ${otp}`);
    console.log(`Generated OTP for ${email}: ${otp}`);

    req.session.tempUser = { firstName, lastName, email, phone, password };
    res.redirect('/auth/verify-otp');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
};

// Step 2: Verify OTP and complete signup
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  console.log(otpStore[email])

  if (!otpStore[email]) {
    return res.status(400).send('OTP expired or invalid.');
  }

  const { otp: storedOtp, timestamp } = otpStore[email];

  if (otp !== storedOtp.toString() || Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).send('Invalid or expired OTP.');
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
      isBlocked:false,
    });

    await newUser.save();

    delete otpStore[email];
    req.session.tempUser = null;

    res.render("user/home",{message : "signed successfull"});
  } catch (error) { 
    console.error('Error during user creation:', error);
    res.status(500).send('Internal server error');
  }  
};

// Resend OTP
exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!req.session.tempUser || req.session.tempUser.email !== email) {
      return res.status(400).json({ success: false, message: 'Invalid email or session expired.' });
    }

    const newOtp = crypto.randomInt(100000, 999999);
    otpStore[email] = { otp: newOtp, timestamp: Date.now() };

    await sendEmail(email, 'Your New OTP', `Your new OTP for signup is ${newOtp}`);
    console.log(`Resent OTP for ${email}: ${newOtp}`);

    res.status(200).json({ success: true, message: 'OTP resent successfully.' });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again.' });
  }
};

// Handle user login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send('Invalid email or password.');
    }
    if(user.isBlocked){
      return res.status(400).send("you are blocked")
    }

    res.render("user/home",{message:"Login Successfull"})
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  } 
};
