const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');
const Wallet = require('../../models/walletModel');
const { format } = require('date-fns');

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

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (['Cancelled', 'Delivered'].includes(order.orderStatus)) {
            return res.status(400).json({ success: false, message: 'Cannot update status of cancelled or delivered orders' });
        }

        order.orderStatus = status;
        if (status === 'Delivered') {
            order.payment.paymentStatus = 'Completed';
            order.items.forEach(item => {
                if (item.status === 'Pending' || item.status === 'Processing' || item.status === 'Shipped') {
                    item.status = 'Delivered';
                }
            });
        } else if (status === 'Cancelled') {
            order.payment.paymentStatus = 'Failed';
            order.items.forEach(item => {
                if (item.status === 'Pending' || item.status === 'Processing' || item.status === 'Shipped') {
                    item.status = 'Cancelled';
                }
            });
        }
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};

exports.handleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action } = req.body;
        const order = await Order.findById(orderId).populate('items.productId');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in the order' });
        }

        if (item.status !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'Item is not pending return' });
        }

        if (action === 'approve') {
            item.status = 'Returned';

            // Restore product stock
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: item.quantity }
            });

            // Calculate refund amount
            let refundAmount = item.subtotal;

            if (order.payment.appliedCoupon) {
                const activeItems = order.items.filter(i => !['Cancelled', 'Returned'].includes(i.status));
                const remainingTotal = activeItems.reduce((sum, i) => sum + i.subtotal, 0);

                const discountRatio = order.payment.couponDiscount / (remainingTotal + item.subtotal);
                const discountProportion = discountRatio * item.subtotal;

                refundAmount -= discountProportion;

                // If this is the last active item being returned
                if (activeItems.length === 1 && activeItems[0]._id.toString() === itemId) {
                    refundAmount += discountProportion;
                }
            }

            // Process refund to wallet
            await Wallet.findOneAndUpdate(
                { user: order.customer.customerId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            amount: refundAmount,
                            type: 'credit',
                            description: `Refund for returned item in order ${order._id}`,
                            orderId: order._id
                        }
                    }
                },
                { upsert: true }
            );

            // Recalculate payment details
            const activeItems = order.items.filter(i => !['Cancelled', 'Returned'].includes(i.status));
            const remainingTotal = activeItems.reduce((sum, i) => sum + i.subtotal, 0);

            order.payment.totalAmount = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            order.payment.discountPrice = remainingTotal;

            if (order.payment.appliedCoupon) {
                order.payment.couponDiscount = remainingTotal > 0
                    ? (order.payment.couponDiscount / (remainingTotal + item.subtotal)) * remainingTotal
                    : 0;
            } else {
                order.payment.couponDiscount = 0;
            }

            order.payment.discount = order.payment.totalAmount - order.payment.discountPrice;
            order.payment.refundedAmount = (order.payment.refundedAmount || 0) + refundAmount;

            // Update payment status
            if (order.payment.totalAmount <= 0) {
                order.payment.paymentStatus = 'Refunded';
            } else {
                order.payment.paymentStatus = 'Partially Refunded';
            }
        } else if (action === 'reject') {
            item.status = 'Return Rejected';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        item.returnProcessedDate = new Date();

        // Update order status
        const activeItems = order.items.filter(i => !['Cancelled', 'Returned'].includes(i.status));
        if (activeItems.length === 0) {
            order.orderStatus = 'Cancelled';
        } else if (order.items.every(i => ['Delivered', 'Cancelled', 'Returned', 'Return Rejected'].includes(i.status))) {
            order.orderStatus = 'Delivered';
        }

        await order.save();

        res.json({ success: true, message: `Return request ${action}d successfully` });
    } catch (error) {
        console.error('Error handling return request:', error);
        res.status(500).json({ success: false, message: 'Failed to handle return request' });
    }
};


module.exports = exports;

