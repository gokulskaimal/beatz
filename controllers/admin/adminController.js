const Admin = require('../../models/adminModel');
const bcrypt = require('bcrypt');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');

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





exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalSales = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$payment.totalAmount" } } }
    ]);
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    const dashboardData = {
      totalUsers,
      totalOrders,
      totalSales: totalSales[0]?.total || 0,
      totalCustomers
    };

    res.render('admin/dashboard', { dashboardData });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).render('error', { message: 'Error fetching dashboard data' });
  }
};

exports.getSalesData = async (req, res) => {
  try {
    const { filter } = req.query;
    let matchStage = {};
    let groupId = {};

    const now = new Date();

    switch (filter) {
      case 'daily':
        matchStage = {
          orderDate: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        };
        groupId = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$orderDate" } };
        break;
      case 'weekly':
        const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        matchStage = { orderDate: { $gte: oneWeekAgo } };
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        break;
      case 'monthly':
        matchStage = {
          orderDate: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        };
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        break;
      case 'yearly':
        matchStage = {
          orderDate: {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lt: new Date(now.getFullYear() + 1, 0, 1)
          }
        };
        groupId = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
        break;
      default:
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        matchStage = { orderDate: { $gte: thirtyDaysAgo } };
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          orders: { $sum: 1 },
          amount: { $sum: "$payment.totalAmount" }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", orders: 1, amount: 1, _id: 0 } }
    ]);

    res.json(salesData);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
};

exports.getBestSelling = async (req, res) => {
  try {
    const { type } = req.params;
    let pipeline = [
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          sales: { $sum: "$items.quantity" }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 10 }
    ];

    if (type === 'categories' || type === 'brands') {
      pipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: "$product" }
      );

      if (type === 'categories') {
        pipeline.push(
          {
            $group: {
              _id: "$product.category",
              sales: { $sum: "$sales" }
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'category'
            }
          },
          { $unwind: "$category" },
          {
            $project: {
              name: "$category.name",
              sales: 1
            }
          }
        );
      } else {
        pipeline.push(
          {
            $group: {
              _id: "$product.specifications.brand",
              sales: { $sum: "$sales" }
            }
          },
          {
            $project: {
              name: "$_id",
              sales: 1
            }
          }
        );
      }
    } else {
      pipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: "$product" },
        {
          $project: {
            product_name: "$product.product_name",
            image: { $arrayElemAt: ["$product.image", 0] },
            sales: 1
          }
        }
      );
    }

    const result = await Order.aggregate(pipeline);
    res.json(result);
  } catch (error) {
    console.error(`Error fetching best selling ${req.params.type}:`, error);
    res.status(500).json({ error: `Failed to fetch best selling ${req.params.type}` });
  }
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

