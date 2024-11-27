const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

exports.getCart = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('user/cart', { cart: [], totalAmount: 0, message: 'Please log in to view your cart.' });
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.render('user/cart', { cart: [], totalAmount: 0, message: 'Your cart is empty.' });
        }

        const cartDetails = cart.items.map(item => ({
            productId: item.productId._id,
            name: item.productId.product_name,
            image: item.productId.image[0],
            price: item.productId.discountPrice || item.productId.price,
            quantity: item.quantity,
            total: (item.productId.discountPrice || item.productId.price) * item.quantity,
        }));

        const totalAmount = cartDetails.reduce((sum, item) => sum + item.total, 0);

        res.render('user/cart', { cart: cartDetails, totalAmount, message: null });
    } catch (err) {
        console.error('Error in getCart:', err);
        res.status(500).render('user/cart', { cart: [], totalAmount: 0, message: 'An error occurred while fetching your cart.' });
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

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            const currentQuantity = cart.items[itemIndex].quantity;
            const newQuantity = currentQuantity + quantity;

            if (newQuantity > 4) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: `You cannot add more than 4 units of this product.` 
                });
            }

            cart.items[itemIndex].quantity = newQuantity;
        } else {
            if (quantity > 4) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'You cannot add more than 4 units of a product to your cart.' 
                });
            }
            cart.items.push({ productId, quantity });
        }

        await cart.save();
        res.status(200).json({ 
            status: 'success', 
            message: 'Product added to cart successfully!' 
        });
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

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(400).json({ status: 'error', message: 'Cart not found.' });
        }

        cart.items = cart.items.filter(item => item.productId.toString() !== productId);
        await cart.save();

        res.status(200).json({ status: 'success', message: 'Product removed from cart.' });
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
            return res.status(400).json({ 
                status: 'error', 
                message: 'You cannot have more than 4 units of a product in your cart.' 
            });
        }

        const product = await Product.findById(productId);
        if (!product || product.stock < quantity) {
            return res.status(400).json({ status: 'error', message: 'Not enough stock available.' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(400).json({ status: 'error', message: 'Cart not found.' });
        }

        const item = cart.items.find(item => item.productId.toString() === productId);
        if (item) {
            item.quantity = quantity;
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

