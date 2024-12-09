const bcrypt = require('bcrypt');
const User = require('../../models/userModel');



// Render Change Password Page
exports.getChangePasswordPage = (req, res) => {
    try {
      res.render('user/changePass', {
        title: 'Change Password',
        user: req.session.user, // Pass user data to the view if needed
        message: null,
      });
    } catch (error) {
      console.error('Error rendering change password page:', error);
      res.status(500).send('Server error. Please try again later.');
    }
  };

  
  // Handle Change Password Request
// Handle Change Password Request
exports.postChangePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
  
    try {
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }
  
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }
  
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
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update user's password
      user.password = hashedPassword;
      await user.save();
  
      // Respond with success
      res.status(200).json({
        success: true,
        message: 'Password changed successfully.',
      });
    } catch (error) {
      console.error('Error handling change password request:', error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  };
  
    