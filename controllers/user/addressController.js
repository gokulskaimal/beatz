const { body, validationResult } = require('express-validator');
const Address = require('../../models/addressModel');
const Cart = require('../../models/cartModel');

exports.getAddresses = async (req, res) => {
    try {
        const userId = req.user._id;
        const [addresses, cart] = await Promise.all([
            Address.find({ userId }),
            Cart.findOne({ userId: req.user._id })
        ]);
        const cartItemCount = cart ? cart.items.length : 0;
        res.render('user/address', { addresses, message: null, user: req.user, cartItemCount });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).render('user/address', {
            addresses: [],
            message: 'Failed to fetch addresses. Please try again later.',
            user: req.user,
            cartItemCount: 0
        });
    }
};

const addressValidationRules = [
    body('name')
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Name must be alphabetic.')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters.')
        .notEmpty().withMessage('Name is required.'),
    body('addressType')
        .trim()
        .isIn(['Home', 'Work', 'Other']).withMessage('Invalid address type.')
        .notEmpty().withMessage('Address type is required.'),
    body('street')
        .trim()
        .isLength({ min: 5, max: 100 }).withMessage('Street must be between 5 and 100 characters.')
        .notEmpty().withMessage('Street is required.'),
    body('city')
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('City must be alphabetic.')
        .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters.')
        .notEmpty().withMessage('City is required.'),
    body('state')
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('State must be alphabetic.')
        .isLength({ min: 2, max: 50 }).withMessage('State must be between 2 and 50 characters.')
        .notEmpty().withMessage('State is required.'),
    body('zipCode')
        .trim()
        .isLength({ min: 5, max: 10 }).withMessage('Zip Code must be between 5 and 10 characters.')
        .notEmpty().withMessage('Zip Code is required.'),
    body('country')
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Country must be alphabetic.')
        .isLength({ min: 2, max: 50 }).withMessage('Country must be between 2 and 50 characters.')
        .notEmpty().withMessage('Country is required.'),
    body('phone')
        .trim()
        .isNumeric().withMessage('Phone number must be numeric.')
        .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits long.')
        .notEmpty().withMessage('Phone number is required.'),
];

exports.addAddress = [
    ...addressValidationRules,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const [addresses, cart] = await Promise.all([
                Address.find({ userId: req.user._id }),
                Cart.findOne({ userId: req.user._id })
            ]);
            const cartItemCount = cart ? cart.items.length : 0;
            return res.status(400).json({
                errors: errors.array(),
                message: 'Validation failed. Please check your input.'
            });
        }

        try {
            const { name, addressType, street, city, state, zipCode, country, phone } = req.body;
            const userId = req.user._id;

            const newAddress = new Address({
                userId,
                name,
                addressType,
                street,
                city,
                state,
                zipCode,
                country,
                phone
            });

            await newAddress.save();

            res.status(201).json({
                message: 'Address added successfully!',
                address: newAddress
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: 'An error occurred while adding the address.'
            });
        }
    }
];

exports.editAddress = [
    ...addressValidationRules,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
                message: 'Validation failed. Please check your input.'
            });
        }

        try {
            const userId = req.user._id;
            const { addressId } = req.params;
            const { name, addressType, street, city, state, zipCode, country, phone } = req.body;

            const updatedAddress = await Address.findOneAndUpdate(
                { _id: addressId, userId },
                { name, addressType, street, city, state, zipCode, country, phone },
                { new: true }
            );

            if (!updatedAddress) {
                return res.status(404).json({ message: 'Address not found.' });
            }

            res.json({
                message: 'Address updated successfully!',
                address: updatedAddress
            });
        } catch (error) {
            console.error('Error editing address:', error);
            res.status(500).json({
                message: 'Failed to edit address. Please try again later.'
            });
        }
    }
];

exports.deleteAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;

        const deletedAddress = await Address.findOneAndDelete({
            _id: addressId,
            userId,
        });

        if (!deletedAddress) {
            return res.status(404).json({ message: 'Address not found.' });
        }

        res.json({ message: 'Address deleted successfully!' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({
            message: 'Failed to delete address. Please try again later.'
        });
    }
};

