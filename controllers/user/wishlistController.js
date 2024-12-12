const User = require('../../models/userModel');
const Product = require('../../models/productModel');
const Wishlist = require('../../models/wishlistModel');
const Cart = require('../../models/cartModel');
const Offer = require('../../models/offerModel');

exports.getWishlist = async (req, res) => {
    try {
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        res.render('user/wishlist', { user: req.user, cartItemCount });
    } catch (error) {
        console.error('Error rendering wishlist page:', error);
        res.status(500).render('error', { message: 'Error loading wishlist page' });
    }
};

exports.getWishlistData = async (req, res) => {
    try {
        const wishlistItems = await Wishlist.find({ userId: req.user._id })
            .populate('productId', 'product_name price discountPrice image stock rating description category createdAt')
            .lean();
        
        const currentDate = new Date();
        const sevenDaysAgo = new Date(currentDate - 7 * 24 * 60 * 60 * 1000);
        
        // Fetch additional offers for products
        const productIds = wishlistItems.map(item => item.productId._id);
        const categoryIds = wishlistItems.map(item => item.productId.category);
        
        const additionalOffers = await Offer.find({
            $or: [
                { applicableProduct: { $in: productIds } },
                { applicableCategory: { $in: categoryIds } }
            ],
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
            isActive: true
        });

        const transformedWishlist = wishlistItems.map(item => {
            const productOffer = additionalOffers.find(offer => 
                offer.applicableProduct && offer.applicableProduct.equals(item.productId._id)
            );
            const categoryOffer = additionalOffers.find(offer => 
                offer.applicableCategory && offer.applicableCategory.equals(item.productId.category)
            );
            
            let bestDiscount = 0;
            let bestOfferSource = null;

            if (productOffer) {
                bestDiscount = Math.max(bestDiscount, productOffer.discountPercentage);
                bestOfferSource = productOffer;
            }

            if (categoryOffer) {
                if (categoryOffer.discountPercentage > bestDiscount) {
                    bestDiscount = categoryOffer.discountPercentage;
                    bestOfferSource = categoryOffer;
                }
            }

            let finalDiscountPrice = item.productId.discountPrice;
            let offer = null;

            if (bestDiscount > 0 && bestOfferSource) {
                finalDiscountPrice = item.productId.discountPrice * (1 - bestDiscount / 100);
                offer = {
                    title: bestOfferSource.title,
                    discountPercentage: bestDiscount
                };
            }

            const isNew = item.productId.createdAt > sevenDaysAgo;

            return {
                _id: item.productId._id,
                wishlistItemId: item._id,
                product_name: item.productId.product_name,
                description: item.productId.description,
                image: item.productId.image,
                price: item.productId.price,
                discountPrice: Math.floor(finalDiscountPrice),
                stock: item.productId.stock,
                rating: item.productId.rating,
                offer: offer,
                isNew: isNew
            };
        });

        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }

        res.json({ success: true, wishlist: transformedWishlist, cartItemCount });
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
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }

        res.json({ success: true, message: 'Product added to wishlist', cartItemCount });
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