const Admin = require('../../models/adminModel');
const bcrypt = require('bcrypt');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } = require('date-fns');

exports.getLoginPage = (req, res) => {
  res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      req.session.admin = admin; // Set session
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: 'Invalid email or password' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

const getDateRange = (filter) => {
  const now = new Date();
  switch (filter) {
    case 'daily':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'weekly':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'monthly':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'yearly':
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: subDays(now, 30), end: now };
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly'; // Default to monthly if no filter provided
    const dateRange = getDateRange(filter);

    const [dashboardData, salesData, bestSellingProducts, bestSellingCategories, bestSellingBrands] = await Promise.all([
      getDashboardData(dateRange),
      getSalesData(dateRange),
      getBestSelling('products', dateRange),
      getBestSelling('categories', dateRange),
      getBestSelling('brands', dateRange)
    ]);

    res.render('admin/dashboard', {
      dashboardData,
      salesData,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
      filter
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).render('error', { message: 'Error fetching dashboard data' });
  }
};

async function getDashboardData(dateRange) {
  const [totalUsers, totalOrders, totalSales, totalCustomers] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments({ 'payment.paymentStatus': 'Completed', orderDate: { $gte: dateRange.start, $lte: dateRange.end } }),
    Order.aggregate([
      { 
        $match: { 
          'payment.paymentStatus': 'Completed',
          orderDate: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      { $group: { _id: null, total: { $sum: "$payment.totalAmount" } } }
    ]),
    User.countDocuments({ role: 'customer' })
  ]);

  return {
    totalUsers,
    totalOrders,
    totalSales: totalSales[0]?.total || 0,
    totalCustomers
  };
}

async function getSalesData(dateRange) {
  return Order.aggregate([
    { 
      $match: { 
        'payment.paymentStatus': 'Completed',
        orderDate: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
        orders: { $sum: 1 },
        amount: { $sum: "$payment.totalAmount" }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", orders: 1, amount: 1, _id: 0 } }
  ]);
}

async function getBestSelling(type, dateRange) {
  let pipeline = [
    { 
      $match: { 
        'payment.paymentStatus': 'Completed',
        orderDate: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
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

  return Order.aggregate(pipeline);
}

exports.getSalesData = async (req, res) => {
  try {
    const { filter } = req.query;
    let matchStage = { 'payment.paymentStatus': 'Completed' };
    let groupId = {};

    const now = new Date();

    switch (filter) {
      case 'daily':
        matchStage.orderDate = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        };
        groupId = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$orderDate" } };
        break;
      case 'weekly':
        const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        matchStage.orderDate = { $gte: oneWeekAgo };
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        break;
      case 'monthly':
        matchStage.orderDate = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        };
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        break;
      case 'yearly':
        matchStage.orderDate = {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lt: new Date(now.getFullYear() + 1, 0, 1)
        };
        groupId = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
        break;
      default:
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        matchStage.orderDate = { $gte: thirtyDaysAgo };
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
      { $match: { 'payment.paymentStatus': 'Completed' } },
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

exports.blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = true;
    await user.save();
    if (req.session.user) {
      delete req.session.user;
    }

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error blocking user' });
  }
};

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

exports.getDashboardData = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const dateRange = getDateRange(filter);

    const [dashboardData, salesData, bestSellingProducts, bestSellingCategories, bestSellingBrands] = await Promise.all([
      getDashboardData(dateRange),
      getSalesData(dateRange),
      getBestSelling('products', dateRange),
      getBestSelling('categories', dateRange),
      getBestSelling('brands', dateRange)
    ]);

    res.json({
      dashboardData,
      salesData,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

module.exports = exports;

