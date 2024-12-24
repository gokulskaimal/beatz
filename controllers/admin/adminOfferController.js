const { body, validationResult } = require('express-validator');
const Offer = require('../../models/offerModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');

exports.getAllOffers = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const offers = await Offer.find({})
            .skip(skip)
            .limit(limit)
            .populate('applicableProduct')
            .populate('applicableCategory');

        const totalOffers = await Offer.countDocuments({});
        const totalPages = Math.ceil(totalOffers / limit);

        res.render('admin/offers', {
            offers,
            currentPage: page,
            totalOffers,
            totalPages,
            itemsPerPage: limit,
            products: await Product.find({}, 'product_name'),
            categories: await Category.find({}, 'name')
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.createOffer = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Offer title must be between 3 and 50 characters.')
        .matches(/^[a-zA-Z0-9\s]+$/).withMessage('Offer title must contain only letters, numbers, and spaces.'),
    body('discountPercentage')
        .isInt({ min: 0, max: 100 }).withMessage('Discount percentage must be a whole number between 0 and 100.'),
    body('offerType')
        .isIn(['Product', 'Category']).withMessage('Offer type must be either Product or Category.'),
    body('applicableItem')
        .notEmpty().withMessage('Applicable item is required.'),
    body('startDate')
        .isISO8601().toDate().withMessage('Start date must be a valid date.')
        .custom((value) => {
            if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
                throw new Error('Start date must be today or in the future.');
            }
            return true;
        }),
    body('endDate')
        .isISO8601().toDate().withMessage('End date must be a valid date.')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.startDate)) {
                throw new Error('End date must be after the start date.');
            }
            return true;
        }),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            const { title, discountPercentage, offerType, applicableItem, startDate, endDate } = req.body;

            const newOffer = new Offer({
                title,
                discountPercentage: parseInt(discountPercentage),
                offerType,
                [offerType === 'Product' ? 'applicableProduct' : 'applicableCategory']: applicableItem,
                startDate,
                endDate
            });

            await newOffer.save();

            res.status(201).json({ success: true, message: 'Offer created successfully' });
        } catch (error) {
            console.error('Error creating offer:', error);
            res.status(500).json({ success: false, message: 'Failed to create offer' });
        }
    }
];

exports.updateOffer = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Offer title must be between 3 and 50 characters.')
        .matches(/^[a-zA-Z0-9\s]+$/).withMessage('Offer title must contain only letters, numbers, and spaces.'),
    body('discountPercentage')
        .isInt({ min: 0, max: 100 }).withMessage('Discount percentage must be a whole number between 0 and 100.'),
    body('offerType')
        .isIn(['Product', 'Category']).withMessage('Offer type must be either Product or Category.'),
    body('applicableItem')
        .notEmpty().withMessage('Applicable item is required.'),
    body('startDate')
        .isISO8601().toDate().withMessage('Start date must be a valid date.'),
    body('endDate')
        .isISO8601().toDate().withMessage('End date must be a valid date.')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.startDate)) {
                throw new Error('End date must be after the start date.');
            }
            return true;
        }),
    body('isActive')
        .isBoolean().withMessage('Status must be a boolean value.'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            const { id, title, discountPercentage, offerType, applicableItem, startDate, endDate, isActive } = req.body;

            const updatedOffer = await Offer.findByIdAndUpdate(id, {
                title,
                discountPercentage: parseInt(discountPercentage),
                offerType,
                [offerType === 'Product' ? 'applicableProduct' : 'applicableCategory']: applicableItem,
                startDate,
                endDate,
                isActive: isActive === 'true'
            }, { new: true });

            if (!updatedOffer) {
                return res.status(404).json({ success: false, message: 'Offer not found' });
            }

            res.json({ success: true, message: 'Offer updated successfully' });
        } catch (error) {
            console.error('Error updating offer:', error);
            res.status(500).json({ success: false, message: 'Failed to update offer' });
        }
    }
];

exports.deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedOffer = await Offer.findByIdAndDelete(id);

        if (!deletedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ success: false, message: 'Failed to delete offer' });
    }
};

