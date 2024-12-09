const Wallet = require('../../models/walletModel');
const Order = require('../../models/orderModel');

exports.getWallet = async (req, res) => {
    const userId = req.user._id;
    try {
        const wallet = await Wallet.findOne({ user: userId }).populate('transactions');
        if (!wallet) {
            const newWallet = new Wallet({ user: userId });
            await newWallet.save();
            return res.render('user/wallet', { wallet: newWallet });
        }
        res.render('user/wallet', { wallet,user:req.user });
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

        res.json({ success: true, message: 'Funds added successfully' });
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

        return { success: true, message: 'Refund processed successfully' };
    } catch (error) {
        console.error('Error processing refund:', error);
        return { success: false, message: 'Failed to process refund' };
    }
};

module.exports = exports;

