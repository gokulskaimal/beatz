const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const Offer = require('../../models/offerModel');
const Cart = require('../../models/cartModel');

exports.getAllProducts = async (req, res) => {
    try {
        const { search, category, brand, minPrice, maxPrice, rating, sort, page = 1 } = req.query;
        const limit = 9; // Number of products per page

        // Build the filter object
        let filter = {
            isBlocked: false // Only show unblocked products
        };
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
                match: { status: 'Active' } // Only populate active categories
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
                applicableCategory: product.category._id,
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
        res.render('user/allProducts', {
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
        console.error('Error in getAllProducts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = exports;

