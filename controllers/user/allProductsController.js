const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');

exports.getAllProducts = async (req, res) => {
    const { search, category, brand, minPrice, maxPrice, rating, sort, page = 1 } = req.query;
    
    let filter = {};
    if (search) filter.product_name = { $regex: search, $options: 'i' };
    if (category) filter.category = category;
    if (brand) filter['specifications.brand'] = brand;
    if (minPrice) filter.discountPrice = { $gte: parseFloat(minPrice) };
    if (maxPrice) filter.discountPrice = { ...filter.discountPrice, $lte: parseFloat(maxPrice) };
    if (rating) filter.rating = { $gte: parseFloat(rating) };

    const sortOptions = {
        newest: { createdAt: -1 },
        price_asc: { discountPrice: 1 },
        price_desc: { discountPrice: -1 },
        rating: { rating: -1 },
    };

    const products = await Product.find(filter)
        .sort(sortOptions[sort] || sortOptions.newest)
        .skip((page - 1) * 9)
        .limit(9);

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / 9);

    const categories = await Category.find();
    const brands = await Product.distinct('specifications.brand');

    if (req.xhr) {
        // For AJAX requests, send JSON
        return res.json({ products, totalPages, currentPage: parseInt(page) });
    }

    // For initial page load, render the full page
    res.render('user/allProducts', {
        products,
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
        currentPage: parseInt(page),user:req.user
    });
};

