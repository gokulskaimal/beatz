// File: controllers/productController.js

const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

exports.getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const { search, sort, category, minPrice, maxPrice, rating } = req.query;

        // Build the filter object
        const filter = {};
        if (search) {
            filter.$text = { $search: search };
        }
        if (category) {
            filter.category = category;
        }
        if (minPrice || maxPrice) {
            filter.discountPrice = {};
            if (minPrice) filter.discountPrice.$gte = parseFloat(minPrice);
            if (maxPrice) filter.discountPrice.$lte = parseFloat(maxPrice);
        }
        if (rating) {
            filter.$expr = { $gte: [{ $avg: "$rating.value" }, parseFloat(rating)] };
        }

        // Build the sort object
        let sortObj = {};
        switch (sort) {
            case 'price_asc':
                sortObj = { discountPrice: 1 };
                break;
            case 'price_desc':
                sortObj = { discountPrice: -1 };
                break;
            case 'rating':
                sortObj = { 'rating.value': -1 };
                break;
            case 'newest':
                sortObj = { createdAt: -1 };
                break;
            default:
                sortObj = { createdAt: -1 };
        }

        const products = await Product.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .populate('category');

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ status: 'active' });

        res.render('user/allProducts', {
            products,
            currentPage: page,
            totalPages,
            categories,
            search,
            sort,
            category,
            minPrice,
            maxPrice,
            rating
        });
    } catch (error) {
        console.error('Error in viewAllProducts:', error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
};