const Coupon = require('../../models/couponsModel');
const Cart = require('../../models/cartModel');

exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ expiryDate: { $gt: new Date() } });
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        res.render('user/coupons', { coupons ,user:req.user,cartItemCount});    
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};