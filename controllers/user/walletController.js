const Wallet = require('../../models/walletModel');
const Order = require('../../models/orderModel');
const Cart = require('../../models/cartModel');

exports.getWallet = async (req, res) => {
    const userId = req.user._id;
    try {
        const wallet = await Wallet.findOne({ user: userId }).populate('transactions');
        if (!wallet) {
            const newWallet = new Wallet({ user: userId });
            await newWallet.save();
            return res.render('user/wallet', { wallet: newWallet,user:req.user,cartItemCount });
        }
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        res.render('user/wallet', { wallet,user:req.user,cartItemCount });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

exports.addFunds = async (req, res) => {
    try {
        const { amount } = req.body;
        let wallet = await Wallet.findOne({ user: req.user._id });

        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.balance += parseFloat(amount);
        wallet.transactions.push({
            amount: parseFloat(amount),
            description: 'Added funds',
            type: 'add',
            date: new Date()
        });

        await wallet.save();
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }

        res.json({ success: true, message: 'Funds added successfully',wallet,user:req.user,cartItemCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.processRefund = async (orderId, userId, refundAmount) => {
    try {
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            description: `Refund for order #${orderId}`,
            type: 'refund',
            orderId: orderId,
            date: new Date()
        });

        await wallet.save();

        // Update the order to reflect the refund
        await Order.findByIdAndUpdate(orderId, {
            $inc: { 'payment.refundedAmount': refundAmount }
        });
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        return { success: true, message: 'Refund processed successfully',wallet,user:req.user,cartItemCount };
    } catch (error) {
        console.error('Error processing refund:', error);
        return { success: false, message: 'Failed to process refund' };
    }
};

module.exports = exports;

