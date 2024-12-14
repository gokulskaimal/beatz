const { format } = require('date-fns');
const Cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const User = require("../../models/userModel");
const Orders = require("../../models/orderModel");
const Product = require("../../models/productModel");
const Offer = require('../../models/offerModel');
const Coupon = require("../../models/couponsModel");

exports.getCheckout = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        const addresses = await Address.find({ userId });
        const cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            // Clear any applied coupon if the cart is empty
            delete req.session.appliedCoupon;
            return res.render("user/checkout", { 
                addresses, 
                cart: null, 
                totalPrice: 0, 
                totalDiscountPrice: 0, 
                discount: 0, 
                totalItems: 0, 
                availableCoupons: [], 
                user,
                appliedCoupon: null,
                user: req.user,
                cartItemCount: 0
            });
        }

        cart.items = cart.items.filter(item => item.product && !item.product.isBlocked);
        let totalPrice = 0;
        let totalDiscountPrice = 0; 
        let totalItems = 0;
        let discount = 0;

        for (let item of cart.items) {
            const itemOriginalPrice = item.product.price * item.quantity;
            const itemDiscountPrice = item.product.discountPrice * item.quantity;
            
            totalPrice += itemOriginalPrice;
            totalDiscountPrice += itemDiscountPrice;
            totalItems += item.quantity;
            discount += itemOriginalPrice - itemDiscountPrice;

            // Apply offers (product and category)
            const productOffer = await Offer.findOne({
                applicableProduct: item.product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: item.product.category,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            let bestDiscount = 0;
            if (productOffer) {
                bestDiscount = Math.max(bestDiscount, productOffer.discountPercentage);
            }
            if (categoryOffer) {
                bestDiscount = Math.max(bestDiscount, categoryOffer.discountPercentage);
            }

            if (bestDiscount > 0) {
                const offerDiscount = itemDiscountPrice * (bestDiscount / 100);
                totalDiscountPrice -= offerDiscount;
                discount += offerDiscount;
            }
        }

        // Check if there's an applied coupon in the session
        let appliedCoupon = req.session.appliedCoupon;
        if (appliedCoupon) {
            const coupon = await Coupon.findById(appliedCoupon.couponId);
            if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
                if (coupon.couponType === 'Percentage') {
                    const couponDiscount = (totalDiscountPrice * coupon.couponValue) / 100;
                    totalDiscountPrice -= couponDiscount;
                    discount += couponDiscount;
                } else {
                    totalDiscountPrice -= coupon.couponValue;
                    discount += coupon.couponValue;
                }
            } else {
                // Remove invalid coupon from session
                delete req.session.appliedCoupon;
                appliedCoupon = null;
            }
        }

        // Fetch available coupons
        const availableCoupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            minPurchaseAmount: { $lte: totalDiscountPrice }
        });

        // Fetch the applied coupon from the session
        const appliedCouponCode = req.session.appliedCoupon ? req.session.appliedCoupon.code : null;

        res.render("user/checkout", { 
            addresses, 
            cart, 
            totalPrice, 
            totalDiscountPrice, 
            discount, 
            totalItems,
            appliedCoupon,
            availableCoupons,
            user,
            appliedCouponCode,
            user: req.user,
            cartItemCount: cart.items.length
        });
    } catch (error) {
        console.error("Get checkout error: ", error);
        res.status(500).render("error", { message: "An error occurred while processing your request." });
    }
};

exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.user._id;

        const cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found or inactive" });
        }

        if (coupon.expiryDate && new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: "Coupon has expired" });
        }

        // Recalculate cart total
        let cartTotal = 0;
        let discount = 0;
        for (let item of cart.items) {
            const itemTotal = item.product.discountPrice * item.quantity;
            cartTotal += itemTotal;

            // Apply offers (product and category)
            const productOffer = await Offer.findOne({
                applicableProduct: item.product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: item.product.category,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            let bestDiscount = 0;
            if (productOffer) {
                bestDiscount = Math.max(bestDiscount, productOffer.discountPercentage);
            }
            if (categoryOffer) {
                bestDiscount = Math.max(bestDiscount, categoryOffer.discountPercentage);
            }

            if (bestDiscount > 0) {
                const offerDiscount = itemTotal * (bestDiscount / 100);
                cartTotal -= offerDiscount;
                discount += offerDiscount;
            }
        }

        if (cartTotal < coupon.minPurchaseAmount) {
            return res.status(400).json({ message: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required for this coupon` });
        }

        let couponDiscount = 0;
        if (coupon.couponType === 'Percentage') {
            couponDiscount = (cartTotal * coupon.couponValue) / 100;
        } else {
            couponDiscount = coupon.couponValue;
        }

        couponDiscount = Math.min(couponDiscount, coupon.maximumDiscount || Infinity);

        const newTotal = cartTotal - couponDiscount;
        discount += couponDiscount;

        // Store the applied coupon in the session
        req.session.appliedCoupon = {
            couponId: coupon._id,
            code: coupon.code,
            discount: couponDiscount
        };

        res.json({
            message: "Coupon applied successfully",
            discount: discount,
            newTotal: newTotal,
            couponDiscount: couponDiscount
        });
    } catch (error) {
        console.error("Apply coupon error: ", error);
        res.status(500).json({ message: "An error occurred while applying the coupon" });
    }
};

exports.removeCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart.findOne({ userId }).populate('items.product');

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        if (!req.session.appliedCoupon) {
            return res.status(400).json({ message: "No coupon is currently applied" });
        }

        // Recalculate cart total without coupon
        let cartTotal = 0;
        let discount = 0;
        for (let item of cart.items) {
            const itemTotal = item.product.discountPrice * item.quantity;
            cartTotal += itemTotal;

            // Apply offers (product and category)
            const productOffer = await Offer.findOne({
                applicableProduct: item.product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: item.product.category,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            let bestDiscount = 0;
            if (productOffer) {
                bestDiscount = Math.max(bestDiscount, productOffer.discountPercentage);
            }
            if (categoryOffer) {
                bestDiscount = Math.max(bestDiscount, categoryOffer.discountPercentage);
            }

            if (bestDiscount > 0) {
                const offerDiscount = itemTotal * (bestDiscount / 100);
                cartTotal -= offerDiscount;
                discount += offerDiscount;
            }
        }

        // Remove the applied coupon from the session
        const removedDiscount = req.session.appliedCoupon.discount;
        delete req.session.appliedCoupon;

        res.json({
            message: "Coupon removed successfully",
            newTotal: cartTotal,
            discount: discount,
            removedCouponDiscount: removedDiscount
        });
    } catch (error) {
        console.error("Remove coupon error: ", error);
        res.status(500).json({ message: "An error occurred while removing the coupon" });
    }
};

module.exports = exports;

