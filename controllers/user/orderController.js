// controllers/orderController.js
const Orders = require('../../models/orderModel');
const Cart = require('../../models/cartModel');
const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const { format } = require('date-fns');
const Address=require('../../models/addressModel');

exports.placeOrder = async (req, res) => {
  try {
      const { addressId, paymentMethod } = req.body;
      const userId = req.user._id;

      const user = await User.findById(userId);
      const shippingAddress = await Address.findById(addressId);
      if (!shippingAddress) {
          return res.status(404).json({ message: "Address not found" });
      }

      const cart = await Cart.findOne({ userId }).populate('items.product');
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ message: "Your cart is empty" });
      }

      const items = cart.items.filter(item => item.product && !item.product.isBlocked);

      let totalAmount = 0;
      let discountPrice = 0;

      const orderItems = await Promise.all(items.map(async (item) => {
          const product = item.product;

          if (product.stock < item.quantity) {
              throw new Error(`Insufficient stock for product ${product.product_name}. Only ${product.stock} items left.`);
          }

          const subtotal = product.discountPrice * item.quantity;
          discountPrice += subtotal;
          const originalPrice = product.price * item.quantity;
          totalAmount += originalPrice;

          return {
              productId: product._id,
              productName: product.product_name,
              quantity: item.quantity,
              price: product.price,
              discountPrice: product.discountPrice,
              subtotal,
              status: 'Pending'
          };
      }));

      const discount = totalAmount - discountPrice;

      const order = new Orders({
          customer: {
              customerId: userId,
              customerName: user.firstName,
              customerEmail: user.email,
              shippingAddress: {
                  name: shippingAddress.name,
                  addressType: shippingAddress.addressType,
                  street: shippingAddress.street,
                  city: shippingAddress.city,
                  state: shippingAddress.state,
                  zipCode: shippingAddress.zipCode,
                  country:shippingAddress.country,
                  phone: shippingAddress.phone
              }
          },
          items: orderItems,
          payment: {
              paymentMethod,
              paymentStatus: 'Pending',
              totalAmount,
              discount,
              discountPrice
          },
      });

      const savedOrder = await order.save();

      await Promise.all(orderItems.map(async (item) => {
          await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: -item.quantity }
          });
      }));

      cart.items = [];
      await cart.save();

      res.status(201).json({ orderId: savedOrder._id });
  } catch (error) {
      console.error("Place order error: ", error);
      res.status(500).json({ message: error.message || 'Failed to place order' });
  }
};


exports.getOrderConfirmation = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Orders.findById(orderId).populate('items.productId');
    
    if (!order) {
      return res.status(404).render('error', { message: 'Order not found' });
    }

    order.formattedDate = format(order.orderDate, 'MMMM dd, yyyy');
    res.render('user/orderConfirmation', { order });
  } catch (error) {
    console.error('Error fetching order confirmation:', error);
    res.status(500).render('error', { message: 'Failed to fetch order confirmation' });
  }
};



exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Orders.find({ 'customer.customerId': userId }).sort({ orderDate: -1 }).populate('items.productId');
    console.log(orders.items)
    const formattedOrders = orders.map(order => ({
      ...order.toObject(),
      formattedDate: format(order.orderDate, 'MMMM dd, yyyy'),
      totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0)
    }));

    res.render('user/myOrders', { orders: formattedOrders,orders });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).render('error', { message: 'Failed to fetch orders' });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Orders.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.customer.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    formatedDate = format(order.orderDate, 'MMMM dd, yyyy');

    res.json({ order ,formatedDate});
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Failed to fetch order details' });
  }
};


exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Orders.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.customer.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Processing') {
      return res.status(400).json({ message: 'This order cannot be cancelled' });
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    // Restore product stock
    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
};