const { body, validationResult } = require('express-validator');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const Offer = require('../../models/offerModel');
const Cart = require('../../models/cartModel');
const User = require('../../models/userModel');

exports.getHome = async (req, res) => {
    try {
        const { search, category, brand, minPrice, maxPrice, rating, sort, page = 1 } = req.query;
        const limit = 9; // Number of products per page

        // Build the filter object
        let filter = { isBlocked: false };
        if (search) filter.product_name = { $regex: search, $options: 'i' };
        if (category) filter.category = category;
        if (brand) filter['specifications.brand'] = brand;
        if (minPrice || maxPrice) {
            filter.discountPrice = {};
            if (minPrice) filter.discountPrice.$gte = parseFloat(minPrice);
            if (maxPrice) filter.discountPrice.$lte = parseFloat(maxPrice);
        }
        if (rating) filter.rating = { $gte: parseFloat(rating) };

        // Define sort options
        const sortOptions = {
            newest: { createdAt: -1 },
            price_asc: { discountPrice: 1 },
            price_desc: { discountPrice: -1 },
            rating: { rating: -1 },
        };

        // Fetch products with active categories
        const products = await Product.find(filter)
            .populate({
                path: 'category',
                match: { status: 'Active' }
            })
            .sort(sortOptions[sort] || sortOptions.newest)
            .skip((page - 1) * limit)
            .limit(limit);

        // Filter out products with inactive categories
        const filteredProducts = products.filter(product => product.category);

        const totalProducts = await Product.countDocuments({
            ...filter,
            category: { $in: await Category.find({ status: 'Active' }).distinct('_id') }
        });
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch active categories and brands for filters
        const categories = await Category.find({ status: 'Active' });
        const brands = await Product.distinct('specifications.brand', { isBlocked: false });

        // Determine if a product is new (e.g., added in the last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Process products with offers and new flag
        const processedProducts = await Promise.all(filteredProducts.map(async (product) => {
            const productObj = product.toObject();
            
            productObj.isNew = product.createdAt > sevenDaysAgo;

            const productOffer = await Offer.findOne({
                applicableProduct: product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: product.category._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

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

            let finalDiscountPrice = productObj.discountPrice;
            let offer = null;

            if (bestDiscount > 0 && bestOfferSource) {
                finalDiscountPrice = productObj.discountPrice * (1 - bestDiscount / 100);
                offer = {
                    title: bestOfferSource.title,
                    discountPercentage: bestDiscount
                };
            }

            return {
                ...productObj,
                discountPrice: Math.floor(finalDiscountPrice),
                offer
            };
        }));

        // Fetch cart item count
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length;
            }
        }

        if (req.xhr) {
            return res.json({ 
                products: processedProducts, 
                totalPages, 
                currentPage: parseInt(page),
                cartItemCount
            });
        }

        res.render('user/home', {
            products: processedProducts,
            categories,
            brands,
            search,
            category,
            selectedBrand: brand,
            minPrice,
            maxPrice,
            rating,
            sort,
            totalPages,
            currentPage: parseInt(page),
            user: req.user,
            cartItemCount
        });
    } catch (error) {
        console.error('Error in getHome:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findOne({ _id: productId, isBlocked: false })
            .populate({
                path: 'category',
                match: { status: 'Active' }
            });

        if (!product || !product.category) {
            return res.status(404).render('user/product', { product: {}, message: 'Product not found' });
        }

        const similarProducts = await Product.find({ 
            category: product.category._id,
            isBlocked: false,
            _id: { $ne: product._id }
        })
        .populate({
            path: 'category',
            match: { status: 'Active' }
        })
        .limit(2);

        const calculateBestDiscount = async (product) => {
            const productOffer = await Offer.findOne({
                applicableProduct: product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: product.category._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

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

            return { bestDiscount, bestOfferSource };
        };

        const { bestDiscount, bestOfferSource } = await calculateBestDiscount(product);

        let finalDiscountPrice = product.discountPrice;
        let offer = null;

        if (bestDiscount > 0 && bestOfferSource) {
            finalDiscountPrice = product.discountPrice * (1 - bestDiscount / 100);
            offer = {
                title: bestOfferSource.title,
                discountPercentage: bestDiscount
            };
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const isNew = product.createdAt > sevenDaysAgo;

        const processedSimilarProducts = await Promise.all(similarProducts.map(async (similarProduct) => {
            const { bestDiscount: similarBestDiscount, bestOfferSource: similarBestOfferSource } = await calculateBestDiscount(similarProduct);
            
            let similarFinalDiscountPrice = similarProduct.discountPrice;
            let similarOffer = null;

            if (similarBestDiscount > 0 && similarBestOfferSource) {
                similarFinalDiscountPrice = similarProduct.discountPrice * (1 - similarBestDiscount / 100);
                similarOffer = {
                    title: similarBestOfferSource.title,
                    discountPercentage: similarBestDiscount
                };
            }

            const isSimilarNew = similarProduct.createdAt > sevenDaysAgo;

            return {
                ...similarProduct.toObject(),
                discountPrice: Math.floor(similarFinalDiscountPrice),
                offer: similarOffer,
                isNew: isSimilarNew
            };
        }));

        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length;
            }
        }

        res.render('user/product', { 
            product: {
                ...product.toObject(),
                discountPrice: Math.floor(finalDiscountPrice),
                offer,
                isNew
            },
            similarProducts: processedSimilarProducts,
            user: req.user,
            cartItemCount,
            message: null
        });
    } catch (error) {
        console.error('Error in getProduct:', error);
        res.status(500).render('user/product', { product: {}, similarProducts: [], message: 'Internal server error' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).redirect('/auth/login');
        }
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length
            }
        }
        res.render('user/profile', { user, message: null, user: req.user, cartItemCount });
    } catch (error) {
        console.error(error);
        res.status(500).render('user/profile', { user: {}, message: 'Server error' });
    }
};

exports.updateProfile = [
    // Validation and sanitization
    body('firstName')
        .trim()
        .isAlpha().withMessage('First name must be alphabetic.')
        .isLength({ min: 2, max: 15 }).withMessage('First name must be between 2 and 30 characters.')
        .notEmpty().withMessage('First name is required.'),
    body('lastName')
        .trim()
        .isAlpha().withMessage('Last name must be alphabetic.')
        .isLength({ min: 2, max: 15 }).withMessage('Last name must be between 2 and 30 characters.')
        .notEmpty().withMessage('Last name is required.'),
    body('phone')
        .trim()
        .isNumeric().withMessage('Phone number must be numeric.')
        .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits long.')
        .notEmpty().withMessage('Phone number is required.'),

    async (req, res) => {
        let cartItemCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ userId: req.user._id });
            if (cart) {
                cartItemCount = cart.items.length;
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('user/profile', {
                user: req.user,
                message: errors.array().map(error => error.msg).join(', '),
                cartItemCount
            });
        }

        try {
            const { firstName, lastName, phone } = req.body;
            const userId = req.user._id;

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { firstName, lastName, phone },
                { new: true }
            ).select('-password');

            // Update the req.user object with the updated user data
            req.user = updatedUser;

            res.render('user/profile', {
                user: updatedUser,
                message: 'Profile updated successfully!',
                cartItemCount
            });
        } catch (err) {
            console.error(err);
            res.status(500).render('user/profile', {
                user: req.user,
                message: 'An error occurred while updating the profile.',
                cartItemCount
            });
        }
    }
];

module.exports = exports;
