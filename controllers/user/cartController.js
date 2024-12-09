const Cart = require('../../models/cartModel');
const Product = require('../../models/productModel');
const Offer = require('../../models/offerModel');

exports.recalculateCart = async (cart) => {
    for (let item of cart.items) {
        const product = await Product.findById(item.product);
        if (!product) {
            console.error(`Product not found for id: ${item.product}`);
            continue;
        }

        let appliedOfferType = null;
        let appliedOfferAmount = 0;
        let offerDetails = [];
        let finalPrice = product.price; // Start with the base price

        // 1. Apply product-specific discount (e.g., sale price, seasonal discount)
        if (product.discount) {
            const productDiscountAmount = (product.price * product.discount) / 100;
            finalPrice -= productDiscountAmount; // Adjust price after product discount
            offerDetails.push({
                type: 'Product Discount',
                description: `Base product discount of ${product.discount}%`,
                discountAmount: productDiscountAmount,
            });
        }

        // 2. Evaluate offers (Product Offer vs Category Offer)
        let productOffer = await Offer.findOne({
            applicableProduct: product._id,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            isActive: true,
        });

        let categoryOffer = await Offer.findOne({
            applicableCategory: product.category,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            isActive: true,
        });

        if (productOffer || categoryOffer) {
            // Compare discount percentages and choose the highest
            const maxOffer = productOffer && categoryOffer
                ? (productOffer.discountPercentage >= categoryOffer.discountPercentage ? productOffer : categoryOffer)
                : productOffer || categoryOffer;

            const maxDiscountAmount = (finalPrice * maxOffer.discountPercentage) / 100; // Apply on adjusted price
            finalPrice -= maxDiscountAmount; // Adjust final price with the best offer
            appliedOfferType = maxOffer.applicableProduct ? 'Product Offer' : 'Category Offer';
            appliedOfferAmount = maxDiscountAmount;

            offerDetails.push({
                type: appliedOfferType,
                description: maxOffer.description || 'Discount applied',
                discountPercentage: maxOffer.discountPercentage,
                discountAmount: maxDiscountAmount,
            });
        }

        // Update item details
        item.finalPrice = finalPrice;
        item.originalTotal = product.price * item.quantity;
        item.total = item.finalPrice * item.quantity;
        item.appliedOfferType = appliedOfferType;
        item.appliedOfferAmount = appliedOfferAmount;
        item.offerDetails = offerDetails;
    }

    // Update cart totals
    cart.subTotal = cart.items.reduce((sum, item) => sum + item.originalTotal, 0);
    cart.totalDiscount = cart.items.reduce((sum, item) => sum + (item.originalTotal - item.total), 0);
    cart.grandTotal = cart.subTotal - cart.totalDiscount - (cart.couponDiscount || 0) + (cart.tax || 0);
};

exports.getCart = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('user/cart', { cart: [], subTotal: 0, totalDiscount: 0, grandTotal: 0,user:req.user, message: 'Please log in to view your cart.' });
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.render('user/cart', { cart: [], subTotal: 0, totalDiscount: 0,user:req.user, grandTotal: 0, message: 'Your cart is empty.' });
        }

        // Recalculate totals and offers
        await this.recalculateCart(cart);

        if (req.xhr) {
            return res.json({
                cart: cart.items,
                subTotal: cart.subTotal,
                totalDiscount: cart.totalDiscount,
                grandTotal: cart.grandTotal
            });
        }

        res.render('user/cart', {
            cart: cart.items,
            subTotal: cart.subTotal,
            totalDiscount: cart.totalDiscount,
            grandTotal: cart.grandTotal,
            message: null,user:req.user
        });
    } catch (err) {
        console.error('Error in getCart:', err);
        res.status(500).render('user/cart', { cart: [], subTotal: 0, totalDiscount: 0,user:req.user, grandTotal: 0, message: 'An error occurred while fetching your cart.' });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'User not logged in.' });
        }

        if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid product or quantity.' });
        }

        const product = await Product.findById(productId);
        if (!product || product.stock < quantity) {
            return res.status(400).json({ status: 'error', message: 'Product not available in the required quantity.' });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
        if (itemIndex > -1) {
            const currentQuantity = cart.items[itemIndex].quantity;
            const newQuantity = currentQuantity + quantity;

            if (newQuantity > 4) {
                return res.status(400).json({ status: 'error', message: 'You cannot add more than 4 units of this product.' });
            }

            cart.items[itemIndex].quantity = newQuantity;
        } else {
            if (quantity > 4) {
                return res.status(400).json({ status: 'error', message: 'You cannot add more than 4 units of a product to your cart.' });
            }
            cart.items.push({
                product: productId,
                quantity,
                price: product.price,
                finalPrice: 0,
                total: 0,
                originalTotal: 0,
                appliedOfferType: null,
                appliedOfferAmount: 0,
                offerDetails: [],
            });
        }

        // Recalculate totals
        await this.recalculateCart(cart);

        await cart.save();
        res.status(200).json({ status: 'success', message: 'Product added to cart successfully!' });
    } catch (err) {
        console.error('Error in addToCart:', err);
        res.status(500).json({ status: 'error', message: 'An error occurred while adding to cart.' });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'User not logged in.' });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(400).json({ status: 'error', message: 'Cart not found.' });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);

        if (cart.items.length === 0) {
            await Cart.findOneAndDelete({ userId });
            return res.status(200).json({ status: 'success', message: 'Product removed from cart.', isEmpty: true });
        } else {
            // Recalculate totals
            await this.recalculateCart(cart);

            await cart.save();
            return res.status(200).json({ status: 'success', message: 'Product removed from cart.', isEmpty: false });
        }
    } catch (err) {
        console.error('Error in removeFromCart:', err);
        res.status(500).json({ status: 'error', message: 'An error occurred while removing from cart.' });
    }
};

exports.updateQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'User not logged in.' });
        }

        if (!productId || quantity <= 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid product or quantity.' });
        }

        if (quantity > 4) {
            return res.status(400).json({ status: 'error', message: 'You cannot have more than 4 units of a product in your cart.' });
        }

        const product = await Product.findById(productId);
        if (!product || product.stock < quantity) {
            return res.status(400).json({ status: 'error', message: 'Not enough stock available.' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(400).json({ status: 'error', message: 'Cart not found.' });
        }

        const item = cart.items.find(item => item.product.toString() === productId);
        if (item) {
            item.quantity = quantity;

            // Recalculate totals
            await this.recalculateCart(cart);

            await cart.save();
            res.status(200).json({ status: 'success', message: 'Quantity updated successfully!' });
        } else {
            res.status(400).json({ status: 'error', message: 'Product not found in cart.' });
        }
    } catch (err) {
        console.error('Error in updateQuantity:', err);
        res.status(500).json({ status: 'error', message: 'An error occurred while updating quantity.' });
    }
};

