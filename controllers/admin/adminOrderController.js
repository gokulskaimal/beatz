const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');

exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find()
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer.customerId', 'firstName lastName email')
      .populate('items.productId', 'product_name image');
      

    res.render('admin/orders', {
      orders,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).render('error', { message: 'Failed to fetch orders' });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('items.productId')
      .populate('customer.customerId', 'firstName lastName email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(orderId, { orderStatus: status }, { new: true });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
};

