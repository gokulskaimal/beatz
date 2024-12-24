const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const User = require('../../models/userModel');
const Cart = require('../../models/cartModel');


// Render Change Password Page
exports.getChangePasswordPage = async (req, res) => {
    try {
      let cartItemCount = 0;
      if (req.user) {
          const cart = await Cart.findOne({ userId: req.user._id });
          if (cart) {
              cartItemCount = cart.items.length
          }
      }
      res.render('user/changePass', {
        title: 'Change Password',
        user: req.session.user, // Pass user data to the view if needed
        message: null,
        cartItemCount
      });
    } catch (error) {
      console.error('Error rendering change password page:', error);
      res.status(500).send('Server error. Please try again later.');
    }
  };

  
  // Handle Change Password Request
// Handle Change Password Request
exports.postChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'),
  body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
          throw new Error('Confirmation password does not match new password.');
      }
      return true;
  }),

  async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      try {
          // Get the user ID from session and fetch the user from the database
          const userId = req.session.user._id;
          const user = await User.findById(userId);

          if (!user) {
              return res.status(404).json({ success: false, message: 'User not found.' });
          }

          // Verify current password
          const isMatch = await bcrypt.compare(currentPassword, user.password);
          if (!isMatch) {
              return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
          }

          // Hash the new password and update the user record
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(newPassword, salt);
          user.password = hashedPassword;
          await user.save();

          res.status(200).json({ success: true, message: 'Password changed successfully.' });
      } catch (error) {
          console.error('Error changing password:', error);
          res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
      }
  }
];
  
     