const { format } = require('date-fns');
const Cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const User = require("../../models/userModel");
const Orders = require("../../models/orderModel");
const Product = require("../../models/productModel");
const Category = require("../../models/categoryModel");
const Offer = require('../../models/offerModel');
const Coupon = require("../../models/couponsModel");

exports.validateCart = async (req, res) => {
    try {
      const userId = req.user._id;
      const cart = await Cart.findOne({ userId }).populate('items.product');
  
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ valid: false, message: 'Your cart is empty.' });
      }
  
      let isValid = true;
      let invalidItems = [];
  
      for (let item of cart.items) {
        if (!item.product) {
          invalidItems.push('A product in your cart is no longer available');
          isValid = false;
          continue;
        }
        const product = await Product.findById(item.product._id);
        if (!product) {
          invalidItems.push(`${item.product.product_name} is no longer available`);
          isValid = false;
        } else if (product.stock < item.quantity) {
          invalidItems.push(`${product.product_name} has insufficient stock (Available: ${product.stock}, In cart: ${item.quantity})`);
          isValid = false;
        }
      }
  
      if (!isValid) {
        return res.status(400).json({
          valid: false,
          message: 'Items in your cart are out of stock or have insufficient quantity.',
          invalidItems: invalidItems
        });
      }
  
      res.json({ valid: true });
    } catch (error) {
      console.error("Validate cart error: ", error);
      res.status(500).json({ valid: false, message: "An error occurred while validating your cart." });
    }
  };
  
  exports.getCheckout = async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);
      const addresses = await Address.find({ userId });
      const cart = await Cart.findOne({ userId }).populate({
        path: 'items.product',
        match: { isBlocked: false },
        populate: {
          path: 'category',
          match: { status: 'Active' }
        }
      });
  
      if (!cart || cart.items.length === 0) {
        delete req.session.appliedCoupon;
        return res.render("user/checkOut", { 
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
  
      // Validate stock before proceeding
      let isValid = true;
      let invalidItems = [];
  
      for (let item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (!product || product.stock < item.quantity) {
          isValid = false;
          invalidItems.push(item.product.product_name);
        }
      }
  
      if (!isValid) {
        return res.status(400).render("error", { 
          message: `Items in your cart are out of stock or have insufficient quantity.`,
          invalidItems: invalidItems
        });
      }
  
      let totalPrice = 0;
      let totalDiscountPrice = 0;
      let totalItems = 0;
  
      cart.items = cart.items.filter(item => item.product && item.product.category);
  
      for (let item of cart.items) {
        totalPrice += item.product.price * item.quantity;
        totalDiscountPrice += item.product.discountPrice * item.quantity;
        totalItems += item.quantity;
  
        // Find applicable offers
        const productOffer = await Offer.findOne({
          applicableProduct: item.product._id,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
          isActive: true
        });
  
        const categoryOffer = await Offer.findOne({
          applicableCategory: item.product.category._id,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
          isActive: true
        });
  
        // Apply best offer
        if (productOffer && (!categoryOffer || productOffer.discountPercentage > categoryOffer.discountPercentage)) {
          item.discountedPrice = item.product.discountPrice * (1 - productOffer.discountPercentage / 100);
        } else if (categoryOffer) {
          item.discountedPrice = item.product.discountPrice * (1 - categoryOffer.discountPercentage / 100);
        } else {
          item.discountedPrice = item.product.discountPrice;
        }
  
        totalDiscountPrice = cart.items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
      }
  
      const discount = totalPrice - totalDiscountPrice;
  
      // Fetch available coupons
      const availableCoupons = await Coupon.find({
        expiryDate: { $gt: new Date() },
        isActive: true, 
        $or: [
          { minimumPurchaseAmount: { $lte: totalDiscountPrice } },
          { minimumPurchaseAmount: { $exists: false } }
        ]
      });
  
      // Apply coupon if exists in session
      let appliedCoupon = null;
      if (req.session.appliedCoupon) {
        appliedCoupon = await Coupon.findById(req.session.appliedCoupon);
        if (appliedCoupon && appliedCoupon.isActive && appliedCoupon.expiryDate > new Date()) {
          if (appliedCoupon.discountType === 'percentage') {
            totalDiscountPrice *= (1 - appliedCoupon.discountAmount / 100);
          } else {
            totalDiscountPrice -= appliedCoupon.discountAmount;
          }
          totalDiscountPrice = Math.max(totalDiscountPrice, 0);  // Ensure total doesn't go negative
        } else {
          delete req.session.appliedCoupon;
          appliedCoupon = null;
        }
      }
  
      res.render("user/checkOut", { 
        addresses, 
        cart: cart, 
        totalPrice, 
        totalDiscountPrice, 
        discount, 
        totalItems, 
        availableCoupons, 
        user,
        appliedCoupon,
        user: req.user,
        cartItemCount: totalItems
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

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            match: { isBlocked: false },
            populate: {
                path: 'category',
                match: { status: 'Active' }
            }
        });

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

        let cartTotal = 0;
        let discount = 0;
        for (let item of cart.items) {
            if (item.product && item.product.category) {
                const itemTotal = item.product.discountPrice * item.quantity;
                cartTotal += itemTotal;

                const productOffer = await Offer.findOne({
                    applicableProduct: item.product._id,
                    startDate: { $lte: new Date() },
                    endDate: { $gte: new Date() },
                    isActive: true
                });

                const categoryOffer = await Offer.findOne({
                    applicableCategory: item.product.category._id,
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
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            match: { isBlocked: false },
            populate: {
                path: 'category',
                match: { status: 'Active' }
            }
        });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        if (!req.session.appliedCoupon) {
            return res.status(400).json({ message: "No coupon is currently applied" });
        }

        let cartTotal = 0;
        let discount = 0;
        for (let item of cart.items) {
            if (item.product && item.product.category) {
                const itemTotal = item.product.discountPrice * item.quantity;
                cartTotal += itemTotal;

                const productOffer = await Offer.findOne({
                    applicableProduct: item.product._id,
                    startDate: { $lte: new Date() },
                    endDate: { $gte: new Date() },
                    isActive: true
                });

                const categoryOffer = await Offer.findOne({
                    applicableCategory: item.product.category._id,
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
        }

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

 