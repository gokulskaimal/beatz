const Admin = require('../../models/adminModel');
const bcrypt = require('bcrypt');
const User = require('../../models/userModel');

exports.getLoginPage = (req, res) => {
  res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      req.session.admin = true; // Set session
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: 'Invalid email or password' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.getDashboard = (req, res) => {
  res.render('admin/dashboard');
};

exports.logout = (req, res) => {
  if (req.session.admin) {
    delete req.session.admin;
    res.redirect('/admin/login?message=Logged out successfully');
  } else {
    res.redirect('/admin/login?message=No active session to log out');
  }
};

// Get Users with Pagination and Search
exports.getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    const query = search
      ? { $or: [{ firstName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};

    const users = await User.find(query).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      users,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// Block User
exports.blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = true;
    await user.save();

    // Clear the user's session if they are currently logged in
    if (req.session.users && req.session.users[user._id]) {
      delete req.session.users[user._id];
    }

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error blocking user' });
  }
};

// Unblock User
exports.unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = false;
    await user.save();
    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error unblocking user' });
  }
};

