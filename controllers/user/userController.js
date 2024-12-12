const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const Offer = require('../../models/offerModel');
const Cart = require('../../models/cartModel');
const User = require('../../models//userModel')

exports.getHome = async (req, res) => {
    try {
        const { search, category, brand, minPrice, maxPrice, rating, sort, page = 1 } = req.query;
        const limit = 9; // Number of products per page

        // Build the filter object
        let filter = {};
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

        // Fetch products
        const products = await Product.find(filter)
            .sort(sortOptions[sort] || sortOptions.newest)
            .skip((page - 1) * limit)
            .limit(limit);

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch categories and brands for filters
        const categories = await Category.find();
        const brands = await Product.distinct('specifications.brand');

        // Determine if a product is new (e.g., added in the last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Process products with offers and new flag
        const processedProducts = await Promise.all(products.map(async (product) => {
            // Convert to plain object to allow modifications
            const productObj = product.toObject();
            
            // Check if product is new
            productObj.isNew = product.createdAt > sevenDaysAgo;

            // Find applicable offers
            const productOffer = await Offer.findOne({
                applicableProduct: product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: product.category,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            // Calculate best discount
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

            // Apply best discount
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
            // For AJAX requests, send JSON
            return res.json({ 
                products: processedProducts, 
                totalPages, 
                currentPage: parseInt(page),
                cartItemCount
            });
        }

        // For initial page load, render the full page
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

        // Fetch product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).render('user/product', { product: {}, message: 'Product not found' });
        }

        // Fetch similar products
        const similarProducts = await Product.find({ category: product.category }).limit(2);

        // Function to calculate the best discount for a product
        const calculateBestDiscount = async (product) => {
            const productOffer = await Offer.findOne({
                applicableProduct: product._id,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                isActive: true
            });

            const categoryOffer = await Offer.findOne({
                applicableCategory: product.category,
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

        // Apply discount calculation to main product
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

        // Check if the product is new (e.g., added in the last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const isNew = product.createdAt > sevenDaysAgo;

        // Apply discount calculation to similar products
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

        // Render product details page
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

exports.updateProfile = async (req, res) => {
    let cartItemCount = 0;
    if (req.user) {
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            cartItemCount = cart.items.length
        }
    }
    try {
        const { firstName, lastName, phone } = req.body;
        const userId = req.user._id;
        if (!firstName || !lastName || !phone) {
            return res.status(400).render('user/profile', {
                user: req.body,
                message: 'All fields are required!',
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { firstName, lastName, phone },
            { new: true }
        ).select('-password');

        res.render('user/profile', {
            user: updatedUser,
            message: 'Profile updated successfully!',
            user: req.user,
            cartItemCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('user/profile', {
            user: req.body,
            message: 'An error occurred while updating the profile.',
            user: req.user,
            cartItemCount
        });
    }
};


module.exports = exports;