const Address = require('../models/addressModel');

// Fetch all addresses for a user
exports.getAddresses = async (req, res) => {
    try {
        const userId = req.user.id;
        const addresses = await Address.find({ userId });
        res.render('user/address', { addresses, message: null });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).render('user/address', {
            addresses: [],
            message: 'Failed to fetch addresses. Please try again later.',
        });
    }
};

// Add a new address
exports.addAddress = async (req, res) => {
    try {
        const { name, street, city, state, zipCode, country, phone } = req.body;
        const userId = req.user.id;

        if (!name || !street || !city || !state || !zipCode || !country || !phone) {
            return res.render('user/address', {
                addresses: await Address.find({ userId }),
                message: 'All fields are required!',
            });
        }

        await Address.create({
            userId,
            name,
            street,
            city,
            state,
            zipCode,
            country,
            phone,
        });

        res.render('user/address', {
            addresses: await Address.find({ userId }),
            message: 'Address added successfully!',
        });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).render('user/address', {
            addresses: await Address.find({ userId }),
            message: 'Failed to add address. Please try again later.',
        });
    }
};

// Edit an existing address
exports.editAddress = async (req, res) => {
    try {
        const userId = req.user.id; // Retrieve the user ID
        const { addressId } = req.params;
        const { name, street, city, state, zipCode, country, phone } = req.body;

        if (!name || !street || !city || !state || !zipCode || !country || !phone) {
            return res.redirect('/user/address');
        }

        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, userId },
            { name, street, city, state, zipCode, country, phone },
            { new: true }
        );

        if (!updatedAddress) {
            return res.render('user/address', {
                addresses: await Address.find({ userId }),
                message: 'Address not found.',
            });
        }

        res.render('user/address', {
            addresses: await Address.find({ userId }),
            message: 'Address updated successfully!',
        });
    } catch (error) {
        console.error('Error editing address:', error);
        const userId = req.user?.id || null; // Fallback in case of undefined userId
        const addresses = userId ? await Address.find({ userId }) : [];
        res.status(500).render('user/address', {
            addresses,
            message: 'Failed to edit address. Please try again later.',
        });
    }
};


// Delete an address
// Delete an address
exports.deleteAddress = async (req, res) => {
    try {
        const userId = req.user.id; // Retrieve the user ID
        const { addressId } = req.params;

        const deletedAddress = await Address.findOneAndDelete({
            _id: addressId,
            userId,
        });

        if (!deletedAddress) {
            return res.render('user/address', {
                addresses: await Address.find({ userId }),
                message: 'Address not found.',
            });
        }

        res.render('user/address', {
            addresses: await Address.find({ userId }),
            message: 'Address deleted successfully!',
        });
    } catch (error) {
        console.error('Error deleting address:', error);
        const userId = req.user?.id || null; // Safely retrieve userId
        const addresses = userId ? await Address.find({ userId }) : [];
        res.status(500).render('user/address', {
            addresses,
            message: 'Failed to delete address. Please try again later.',
        });
    }
};

