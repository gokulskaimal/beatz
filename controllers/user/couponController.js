const Coupon = require('../../models/couponsModel');

exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ expiryDate: { $gt: new Date() } });
        res.render('user/coupons', { coupons ,user:req.user});
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};