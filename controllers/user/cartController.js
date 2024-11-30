const Cart = require('../../models/cartModel');
const Product = require('../../models/productModel');

exports.getCart = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('user/cart', { cart: [], message: 'Please log in to view your cart.' });
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.render('user/cart', { cart: [], message: 'Your cart is empty.' });
        }

        // Calculate totals for each item
        cart.items.forEach(item => {
            item.price = item.product.discountPrice || item.product.price;
            item.originalTotal = item.price * item.quantity;
            item.total = item.originalTotal - (item.finalPrice || 0);
        });

        // Recalculate cart-level totals
        cart.subTotal = cart.items.reduce((sum, item) => sum + item.originalTotal, 0);
        cart.totalDiscount = cart.items.reduce((sum, item) => sum + (item.originalTotal - item.total), 0);
        cart.grandTotal = cart.subTotal - cart.totalDiscount + cart.couponDiscount + cart.tax;

        await cart.save();

        if (req.xhr) {
            return res.json({ cart: cart.items, grandTotal: cart.grandTotal });
        }

        res.render('user/cart', { cart: cart.items, grandTotal: cart.grandTotal, message: null });
    } catch (err) {
        console.error('Error in getCart:', err);
        res.status(500).render('user/cart', { cart: [], message: 'An error occurred while fetching your cart.' });
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
            cart.items[itemIndex].price = product.discountPrice || product.price;
        } else {
            if (quantity > 4) {
                return res.status(400).json({ status: 'error', message: 'You cannot add more than 4 units of a product to your cart.' });
            }
            cart.items.push({
                product: productId,
                quantity,
                price: product.discountPrice || product.price,
                finalPrice: 0,
                total: 0,
                originalTotal: 0
            });
        }

        // Recalculate totals
        cart.subTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.grandTotal = cart.subTotal - cart.totalDiscount + cart.couponDiscount + cart.tax;

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
            cart.subTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            cart.grandTotal = cart.subTotal - cart.totalDiscount + cart.couponDiscount + cart.tax;

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
            item.total = item.price * quantity;

            // Recalculate totals
            cart.subTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            cart.grandTotal = cart.subTotal - cart.totalDiscount + cart.couponDiscount + cart.tax;

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