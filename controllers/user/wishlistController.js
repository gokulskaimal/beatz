const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Wishlist = require('../../models/wishlistModel');

exports.getWishlist = async (req, res) => {
    try {
        res.render('user/wishlist',{user:req.user});
    } catch (error) {
        console.error('Error rendering wishlist page:', error);
        res.status(500).render('error', { message: 'Error loading wishlist page' });
    }
};

exports.getWishlistData = async (req, res) => {
    try {
        const wishlistItems = await Wishlist.find({ userId: req.user._id })
            .populate('productId', 'product_name price discountPrice image stock rating description')
            .lean();
        
        const transformedWishlist = wishlistItems.map(item => ({
            _id: item.productId._id,
            wishlistItemId: item._id,
            product_name: item.productId.product_name,
            description: item.productId.description,
            image: item.productId.image,
            price: item.productId.price,
            discountPrice: item.productId.discountPrice,
            stock: item.productId.stock,
            rating: item.productId.rating
        }));

        res.json({ success: true, wishlist: transformedWishlist });
    } catch (error) {
        console.error('Error fetching wishlist data:', error);
        res.status(500).json({ success: false, message: 'Error fetching wishlist data' });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existingItem = await Wishlist.findOne({ userId: req.user._id, productId });
        if (existingItem) {
            return res.status(400).json({ success: false, message: 'Product already in wishlist' });
        }

        const wishlistItem = new Wishlist({
            userId: req.user._id,
            productId: productId
        });
        await wishlistItem.save();

        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Error adding to wishlist' });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const { wishlistItemId } = req.body;

        const result = await Wishlist.findOneAndDelete({ _id: wishlistItemId, userId: req.user._id });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Wishlist item not found' });
        }

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ success: false, message: 'Error removing from wishlist' });
    }
};

exports.toggleWishlistItem = async (req, res) => {
    try {
        const { productId } = req.body;

        const existingItem = await Wishlist.findOne({ userId: req.user._id, productId });

        if (existingItem) {
            await Wishlist.findByIdAndDelete(existingItem._id);
            res.json({ success: true, message: 'Product removed from wishlist' });
        } else {
            const wishlistItem = new Wishlist({
                userId: req.user._id,
                productId: productId
            });
            await wishlistItem.save();
            res.json({ success: true, message: 'Product added to wishlist' });
        }
    } catch (error) {
        console.error('Error toggling wishlist item:', error);
        res.status(500).json({ success: false, message: 'Error updating wishlist' });
    }
};

