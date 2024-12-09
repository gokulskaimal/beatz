const User = require('../../models/userModel');
const Product = require('../../models/productModel');

// Fetch Home Page
exports.getHome = async (req, res) => {
    try {
        const perPage = 10; 
        const currentPage = parseInt(req.query.page) || 1;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / perPage);

        const products = await Product.find()
            .populate('category')
            .skip((currentPage - 1) * perPage)
            .limit(perPage);

        res.render('user/home', { products, message: null,user:req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// Fetch User Profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).redirect('/auth/login');
        }
        res.render('user/profile', { user, message: null });
    } catch (error) {
        console.error(error);
        res.status(500).render('user/profile', { user: {}, message: 'Server error' });
    }
};

// Update User Profile
exports.updateProfile = async (req, res) => {
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
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('user/profile', {
            user: req.body,
            message: 'An error occurred while updating the profile.',
        });
    }
};

// Fetch Product Details
exports.getProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).render('user/product', { product: {}, similarProducts: [], message: 'Product not found' });
        }
        const similarProducts = await Product.find({ category: product.category }).limit(2);
        console.log(product);
        res.render('user/product', { product, similarProducts,user:req.user, message: null });
    } catch (err) {
        console.error(err); 
        res.status(500).send("Server Error");
    }
};



