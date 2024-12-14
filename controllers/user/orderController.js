const Orders = require('../../models/orderModel');
const Cart = require('../../models/cartModel');
const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Coupon = require('../../models/couponsModel');
const Address = require('../../models/addressModel');
const Wallet = require('../../models/walletModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { format } = require('date-fns');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

            const subtotal = item.finalPrice * item.quantity;
            discountPrice += subtotal;
            const originalPrice = product.price * item.quantity;
            totalAmount += originalPrice;

            return {
                productId: product._id,
                productName: product.product_name,
                quantity: item.quantity,
                price: product.price,
                discountPrice: item.finalPrice,
                subtotal,
                status: 'Pending'
            };
        }));

        let discount = totalAmount - discountPrice;
        let couponDiscount = 0;
        let appliedCoupon = null;

        if (req.session.appliedCoupon) {
            const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
            if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
                appliedCoupon = {
                    couponId: coupon._id,
                    code: coupon.code,
                    discountAmount: req.session.appliedCoupon.discount
                };
                couponDiscount = req.session.appliedCoupon.discount;
                discountPrice -= couponDiscount;
                discount += couponDiscount;

                await Coupon.findByIdAndUpdate(coupon._id, {
                    $inc: { totalUsageLimit: -1 },
                    $push: {
                        usageByUser: {
                            userId: userId,
                            count: 1
                        }
                    }
                });
            }
        }

        if (paymentMethod === 'Wallet') {
            const wallet = await Wallet.findOne({ user: userId });
            if (!wallet || wallet.balance < discountPrice) {
                return res.status(400).json({ message: "Insufficient wallet balance" });
            }
        }

        // Check if COD is allowed for orders above Rs 1000
        if (paymentMethod === 'Cash On Delivery' && discountPrice > 1000) {
            return res.status(400).json({ message: "Cash On Delivery is not available for orders above Rs 1000" });
        }

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
                    country: shippingAddress.country,
                    phone: shippingAddress.phone
                }
            },
            items: orderItems,
            payment: {
                paymentMethod,
                paymentStatus: paymentMethod === 'Cash On Delivery' ? 'Pending' : 'Completed',
                totalAmount,
                discount,
                discountPrice,
                couponDiscount,
                appliedCoupon
            },
            coupon: appliedCoupon?.couponId
        });

        const savedOrder = await order.save();

        await Promise.all(orderItems.map(async (item) => {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity }
            });
        }));

        cart.items = [];
        await cart.save();

        delete req.session.appliedCoupon;

        if (paymentMethod === 'Razorpay') {
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(discountPrice * 100),
                currency: 'INR',
                receipt: savedOrder._id.toString()
            });

            savedOrder.payment.razorpayOrderId = razorpayOrder.id;
            savedOrder.payment.paymentStatus = 'Pending';
            await savedOrder.save();

            return res.status(200).json({ order: razorpayOrder });
        } 
        else if (paymentMethod === 'Wallet') {
            await Wallet.findOneAndUpdate(
                { user: userId },
                { 
                    $inc: { balance: -discountPrice },
                    $push: {
                        transactions: {
                            amount: discountPrice,
                            type: 'debit',
                            description: `Payment for order ${savedOrder._id}`,
                            orderId: savedOrder._id
                        }
                    }
                }
            );
        }

        res.status(201).json({ orderId: savedOrder._id });
    } catch (error) {
        console.error("Place order error: ", error);
        res.status(500).json({ message: error.message || 'Failed to place order' });
    }
};

exports.continuePayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.payment.paymentStatus !== 'Failed' && order.payment.paymentStatus !== 'Pending') {
            return res.status(400).json({ message: 'This order does not require payment continuation' });
        }
       
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(order.payment.discountPrice * 100),
            currency: 'INR',
            receipt: order._id.toString()
        });

        order.payment.razorpayOrderId = razorpayOrder.id;
        order.payment.paymentStatus = 'Pending';
        await order.save();

        res.json({
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error continuing payment:', error);
        res.status(500).json({ message: 'Failed to continue payment' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId, signature } = req.body;
        const order = await Orders.findOne({ 'payment.razorpayOrderId': orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === signature) {
            order.payment.paymentStatus = 'Completed';
            order.payment.razorpayPaymentId = paymentId;
            await order.save();

            res.json({ success: true, message: 'Payment verified successfully', orderId: order._id });
        } else {
            order.payment.paymentStatus = 'Failed';
            await order.save();

            res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error("Payment verification error: ", error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

exports.handlePaymentFailure = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Orders.findOne({ 'payment.razorpayOrderId': orderId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.payment.paymentStatus = 'Failed';
        await order.save();

        res.json({ message: 'Payment failure recorded successfully', orderId: order._id });
    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({ message: 'Failed to handle payment failure' });
    }
};

exports.cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const order = await Orders.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.customer.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found in the order' });
        }

        if (item.status !== 'Pending' && item.status !== 'Processing') {
            return res.status(400).json({ message: 'This item cannot be cancelled' });
        }

        item.status = 'Cancelled';

        // Restore product stock
        await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
        });

        // Calculate refund amount
        let refundAmount = item.subtotal;

        // If there's a coupon applied, calculate the proportional discount
        if (order.payment.appliedCoupon) {
            const orderTotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
            const itemTotal = item.subtotal;
            const discountRatio = (order.payment.couponDiscount / orderTotal) * 100;
            const discountValue = (orderTotal * discountRatio) / 100;
            const discountProportion = (discountValue / orderTotal) * itemTotal;
            refundAmount = item.subtotal - discountProportion;

            // Check if this is the last item being returned
            const activeItems = order.items.filter(i => !['Cancelled', 'Returned'].includes(i.status));
            if (activeItems.length === 1 && activeItems[0]._id.toString() === itemId) {
                // This is the last item, include any remaining coupon discount
                const remainingCouponDiscount = order.payment.couponDiscount - discountProportion;
                refundAmount -= remainingCouponDiscount;
            }
        }

        // Process refund
        if (order.payment.paymentMethod !== 'Cash On Delivery') {
            await Wallet.findOneAndUpdate(
                { user: order.customer.customerId },
                { 
                    $inc: { balance: refundAmount },
                    $push: { 
                        transactions: {
                            amount: refundAmount,
                            type: 'credit',
                            description: `Refund for cancelled item in order ${order._id}`,
                            orderId: order._id
                        }
                    }
                },
                { upsert: true }
            );
        }

        // Update order status
        const allCancelled = order.items.every(item => item.status === 'Cancelled');
        if (allCancelled) {
            order.orderStatus = 'Cancelled';
            order.payment.paymentStatus = 'Refunded';
        } else {
            order.orderStatus = 'Partially Cancelled';
            if (order.payment.paymentStatus === 'Completed') {
                order.payment.paymentStatus = 'Partially Refunded';
            }
        }

        await order.save();

        res.json({ message: 'Item cancelled successfully', order });
    } catch (error) {
        console.error('Error cancelling order item:', error);
        res.status(500).json({ message: 'Failed to cancel order item' });
    }
};

exports.getWalletBalance = async (req, res) => {
    try {
        const userId = req.user._id;
        const wallet = await Wallet.findOne({ user: userId });
        const balance = wallet ? wallet.balance : 0;
        res.json({ balance });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ message: 'Failed to fetch wallet balance' });
    }
};

exports.getOrderConfirmation = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId).populate('items.productId');
        
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }
        let cartItemCount = 0;
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            cartItemCount = cart.items.length;
        }

        order.formattedDate = format(order.orderDate, 'MMMM dd, yyyy');
        res.render('user/orderConfirmation', { order, user: req.user, cartItemCount: cart.items.length });
    } catch (error) {
        console.error('Error fetching order confirmation:', error);
        res.status(500).render('error', { message: 'Failed to fetch order confirmation' });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const orders = await Orders.find({ 'customer.customerId': userId }).sort({ orderDate: -1 }).populate('items.productId');
        const formattedOrders = orders.map(order => ({
            ...order.toObject(),
            formattedDate: format(order.orderDate, 'MMMM dd, yyyy'),
            totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0)
        }));
        
        let cartItemCount = 0;
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            cartItemCount = cart.items.length;
        }

        res.render('user/myOrders', { orders: formattedOrders, user: req.user, cartItemCount });
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

        const formattedDate = format(order.orderDate, 'MMMM dd, yyyy');
        let cartItemCount = 0;
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            cartItemCount = cart.items.length;
        }

        res.json({ order, formattedDate, cartItemCount });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Failed to fetch order details' });
    }
};

exports.requestReturn = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const order = await Orders.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.customer.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found in the order' });
        }

        if (item.status !== 'Delivered') {
            return res.status(400).json({ message: 'Only delivered items can be returned' });
        }

        item.status = 'Return Requested';
        item.returnReason = reason;
        item.returnRequestDate = new Date();

        await order.save();
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        res.json({ message: 'Return request submitted successfully', cartItemCount });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ message: 'Failed to submit return request' });
    }
};

exports.generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId).populate('items.productId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const doc = new PDFDocument();
        const filename = `invoice-${orderId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(18).text('Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Order ID: ${order._id}`);
        doc.text(`Date: ${format(order.orderDate, 'MMMM dd, yyyy')}`);
        doc.moveDown();

        // Customer details
        doc.text(`Customer: ${order.customer.customerName}`);
        doc.text(`Email: ${order.customer.customerEmail}`);
        doc.moveDown();

        // Shipping Address
        doc.text('Shipping Address:');
        doc.text(order.customer.shippingAddress.name);
        doc.text(order.customer.shippingAddress.street);
        doc.text(`${order.customer.shippingAddress.city}, ${order.customer.shippingAddress.state} ${order.customer.shippingAddress.zipCode}`);
        doc.text(order.customer.shippingAddress.country);
        doc.moveDown();

        // Order Items
        doc.text('Order Items:');
        order.items.forEach(item => {
            doc.text(`${item.productName} - Quantity: ${item.quantity} - Price: ₹${item.discountPrice.toFixed(2)}`);
        });
        doc.moveDown();

        // Total
        doc.text(`Subtotal: ₹${order.payment.totalAmount.toFixed(2)}`);
        doc.text(`Discount: ₹${order.payment.discount.toFixed(2)}`);
        doc.text(`Total: ₹${order.payment.discountPrice.toFixed(2)}`);

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Failed to generate invoice' });
    }
};



module.exports = exports;

