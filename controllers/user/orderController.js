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

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            match: { isBlocked: false },
            populate: {
                path: 'category',
                match: { status: 'Active' }
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Your cart is empty" });
        }

        const items = cart.items.filter(item => item.product && item.product.category);
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
                            description: `Payment for ORD.No: ${savedOrder._id.toString().slice(-6)}`,
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

        // Mark item as cancelled
        item.status = 'Cancelled';

        // Restore product stock
        await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
        });

        // Calculate refund amount
        let refundAmount = item.subtotal;

        if (order.payment.appliedCoupon && order.payment.couponDiscount > 0) {
            const remainingTotal = order.items
                .filter(i => !['Cancelled', 'Returned'].includes(i.status))
                .reduce((sum, i) => sum + i.subtotal, 0);

            const discountRatio = order.payment.couponDiscount / (remainingTotal + item.subtotal);
            const discountProportion = discountRatio * item.subtotal;
            refundAmount -= discountProportion;

            // If this is the last active item
            const activeItems = order.items.filter(
                i => !['Cancelled', 'Returned'].includes(i.status)
            );
            if (activeItems.length === 1 && activeItems[0]._id.toString() === itemId) {
                refundAmount += discountProportion;
            }
        }

        // Process refund if not Cash On Delivery
        if (
            order.payment.paymentMethod !== 'Cash On Delivery' &&
            order.payment.paymentStatus !== 'Pending' &&
            order.payment.paymentStatus !== 'Failed'
        ) {
            await Wallet.findOneAndUpdate(
                { user: order.customer.customerId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            amount: refundAmount,
                            type: 'credit',
                            description: `Refund for cancelled item in ORD.NO: ${order._id.toString().slice(-6)}`,
                            orderId: order._id
                        }
                    }
                },
                { upsert: true }
            );
        }

        // Recalculate payment details
        const remainingItems = order.items.filter(i => !['Cancelled', 'Returned'].includes(i.status));
        order.payment.totalAmount = remainingItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        order.payment.discountPrice = remainingItems.reduce((sum, i) => sum + i.subtotal, 0);

        if (order.payment.appliedCoupon && order.payment.couponDiscount > 0) {
            const remainingTotal = remainingItems.reduce((sum, i) => sum + i.subtotal, 0);
            order.payment.couponDiscount = remainingTotal > 0
                ? (order.payment.couponDiscount / (remainingTotal + item.subtotal)) * remainingTotal
                : 0;
        } else {
            order.payment.couponDiscount = 0;
        }

        order.payment.discount = order.payment.totalAmount - order.payment.discountPrice;
        order.payment.refundedAmount = (order.payment.refundedAmount || 0) + refundAmount;

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

        // Save changes
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

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const filename = `invoice-${orderId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // Helper function to draw a line
        const drawLine = (y) => {
            doc.moveTo(50, y)
               .lineTo(550, y)
               .stroke();
        };

        // Add content to PDF
        doc.fontSize(20).text('Invoice', { align: 'center' });
        doc.moveDown();

        // Company details (replace with your company details)
        doc.fontSize(10).text('Beatz', { align: 'left' });

        doc.moveDown();

        // Invoice details
        doc.fontSize(10).text(`Invoice Number: INV-${order._id.toString().slice(-6)}`, { align: 'right' });
        doc.text(`Date: ${format(order.orderDate, 'MMMM dd, yyyy')}`, { align: 'right' });
        doc.moveDown();

        // Customer details
        // doc.fontSize(12).text('Bill To:');
        // doc.fontSize(10).text(order.customer.customerName);
        // doc.text(order.customer.customerEmail);
        // doc.moveDown();

        // Shipping Address
        doc.fontSize(12).text('Ship To:');
        doc.fontSize(10).text(order.customer.shippingAddress.name);
        doc.text(order.customer.shippingAddress.street);
        doc.text(`${order.customer.shippingAddress.city}, ${order.customer.shippingAddress.state} ${order.customer.shippingAddress.zipCode}`);
        doc.text(order.customer.shippingAddress.country);
        doc.moveDown();

        // Order Items Table
        const tableTop = 300;
        const descriptionX = 100;
        const quantityX = 350;
        const priceX = 400;
        const amountX = 500;

        doc.font('Helvetica-Bold');
        doc.text('Description', descriptionX, tableTop);
        doc.text('Qty', quantityX, tableTop, { width: 50, align: 'center' });
        doc.text('Price', priceX, tableTop, { width: 70, align: 'right' });
        doc.text('Amount', amountX, tableTop, { width: 70, align: 'right' });

        drawLine(tableTop + 15);
        doc.font('Helvetica');

        let position = 0;
        order.items.forEach((item, index) => {
            position = tableTop + 25 + (index * 25);
            
            doc.text(item.productName, descriptionX, position, { width: 200 });
            doc.text(item.quantity.toString(), quantityX, position, { width: 50, align: 'center' });
            doc.text(`₹${item.discountPrice.toFixed(2)}`, priceX, position, { width: 70, align: 'right' });
            doc.text(`₹${(item.discountPrice * item.quantity).toFixed(2)}`, amountX, position, { width: 70, align: 'right' });
        });

        drawLine(position + 20);

        // Total
        const totalPosition = position + 35;
        doc.font('Helvetica-Bold');
        doc.text('Subtotal:', 400, totalPosition);
        doc.text(`₹${order.payment.totalAmount.toFixed(2)}`, amountX, totalPosition, { width: 70, align: 'right' });

        doc.text('Discount:', 400, totalPosition + 20);
        doc.text(`₹${order.payment.discount.toFixed(2)}`, amountX, totalPosition + 20, { width: 70, align: 'right' });

        drawLine(totalPosition + 35);

        doc.fontSize(12);
        doc.text('Total:', 400, totalPosition + 45);
        doc.text(`₹${order.payment.discountPrice.toFixed(2)}`, amountX, totalPosition + 45, { width: 70, align: 'right' });

        // Footer
        doc.fontSize(10).text('Thank you for your business!', 50, 700, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Failed to generate invoice' });
    }
};


module.exports = exports;
