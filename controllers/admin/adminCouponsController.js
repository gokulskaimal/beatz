const Coupon = require('../../models/couponsModel');

// Helper function for validation
const validateCoupon = (couponData) => {
    const errors = [];

    // Validate code
    if (!couponData.code || typeof couponData.code !== 'string') {
        errors.push('Coupon code is required and must be a string');
    } else if (couponData.code.length > 15) {
        errors.push('Coupon code cannot be more than 15 characters');
    } else if (!/^[A-Z0-9]+$/.test(couponData.code)) {
        errors.push('Coupon code can only contain uppercase letters and numbers');
    }

    // Validate coupon type
    if (!['Percentage', 'Fixed'].includes(couponData.couponType)) {
        errors.push('Invalid coupon type. Must be either Percentage or Fixed');
    }

    // Validate coupon value
    const couponValue = parseFloat(couponData.couponValue);
    if (isNaN(couponValue) || couponValue <= 0) {
        errors.push('Coupon value must be a positive number');
    } else if (couponData.couponType === 'Percentage' && couponValue > 100) {
        errors.push('Percentage discount must be between 0 and 100');
    }

    // Validate minimum purchase amount
    const minPurchaseAmount = parseFloat(couponData.minPurchaseAmount);
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 0) {
        errors.push('Minimum purchase amount must be a non-negative number');
    }

    // Validate dates
    const startDate = new Date(couponData.startDate);
    const expiryDate = new Date(couponData.expiryDate);
    const now = new Date();

    if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date');
    }

    if (isNaN(expiryDate.getTime())) {
        errors.push('Invalid expiry date');
    } else if (expiryDate <= startDate) {
        errors.push('Expiry date must be after the start date');
    }

    // Validate total usage limit
    const totalUsageLimit = parseInt(couponData.totalUsageLimit);
    if (isNaN(totalUsageLimit) || totalUsageLimit < 1) {
        errors.push('Total usage limit must be a positive integer');
    }

    return errors;
};

exports.getCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const coupons = await Coupon.find().skip(skip).limit(limit);
        const totalCoupons = await Coupon.countDocuments();

        res.render('admin/coupons', {
            coupons,
            currentPage: page,
            totalCoupons,
            itemsPerPage: limit
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Server error occurred while fetching coupons' });
    }
};

exports.addCoupon = async (req, res) => {
    try {
        const validationErrors = validateCoupon(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: 'Validation error', errors: validationErrors });
        }

        const newCoupon = new Coupon({
            ...req.body,
            code: req.body.code.toUpperCase(),
            couponValue: parseFloat(req.body.couponValue),
            minPurchaseAmount: parseFloat(req.body.minPurchaseAmount),
            totalUsageLimit: parseInt(req.body.totalUsageLimit)
        });

        await newCoupon.save();
        res.json({ success: true, message: 'Coupon added successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'Coupon code already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Server error occurred while adding coupon' });
        }
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const validationErrors = validateCoupon(updateData);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: 'Validation error', errors: validationErrors });
        }

        const existingCoupon = await Coupon.findById(id);
        if (!existingCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(id, {
            ...updateData,
            code: updateData.code.toUpperCase(),
            couponValue: parseFloat(updateData.couponValue),
            minPurchaseAmount: parseFloat(updateData.minPurchaseAmount),
            totalUsageLimit: parseInt(updateData.totalUsageLimit)
        }, { new: true });

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.json({ success: true, message: 'Coupon updated successfully', coupon: updatedCoupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'Coupon code already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Server error occurred while updating coupon' });
        }
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error occurred while deleting coupon' });
    }
};

exports.searchCoupons = async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;

        let searchQuery = {};
        if (query) {
            searchQuery = {
                $or: [
                    { code: { $regex: query, $options: 'i' } },
                    { couponType: { $regex: query, $options: 'i' } },
                ]
            };
        }

        const coupons = await Coupon.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCoupons = await Coupon.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCoupons / limit);

        res.json({
            success: true,
            coupons,
            currentPage: parseInt(page),
            totalPages
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error occurred while searching coupons' });
    }
};

