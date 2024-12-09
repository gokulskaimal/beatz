const Address = require('../../models/addressModel');

exports.getAddresses = async (req, res) => {
    try {
        const userId = req.user._id;
        const addresses = await Address.find({ userId });
        res.render('user/address', { addresses, message: null ,user:req.user});
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).render('user/address', {
            addresses: [],
            message: 'Failed to fetch addresses. Please try again later.',user:req.user
        });
    }
};

exports.addAddress = async (req, res) => {
    try {
        const { name, addressType, street, city, state, zipCode, country, phone } = req.body;
        const userId = req.user._id;

        if (!name || !addressType || !street || !city || !state || !zipCode || !country || !phone) {
            return res.status(400).json({ message: 'All fields are required!' });
        }

        const newAddress = await Address.create({
            userId,
            name,
            addressType,
            street,
            city,
            state,
            zipCode,
            country,
            phone,
        });

        res.status(201).json({ message: 'Address added successfully!', address: newAddress });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'Failed to add address. Please try again later.' });
    }
};

exports.editAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;
        const { name, addressType, street, city, state, zipCode, country, phone } = req.body;

        if (!name || !addressType || !street || !city || !state || !zipCode || !country || !phone) {
            return res.status(400).json({ message: 'All fields are required!' });
        }

        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, userId },
            { name, addressType, street, city, state, zipCode, country, phone },
            { new: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({ message: 'Address not found.' });
        }

        res.json({ message: 'Address updated successfully!', address: updatedAddress });
    } catch (error) {
        console.error('Error editing address:', error);
        res.status(500).json({ message: 'Failed to edit address. Please try again later.' });
    }
};

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
        res.status(500).json({ message: 'Failed to delete address. Please try again later.' });
    }
};

