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

exports.createOffer = async (req, res) => {
    try {
        const { title, discountPercentage, offerType, applicableItem, startDate, endDate } = req.body;

        const newOffer = new Offer({
            title,
            discountPercentage,
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
};

exports.updateOffer = async (req, res) => {
    try {
        const { offerId, title, discountPercentage, offerType, applicableItem, startDate, endDate, isActive } = req.body;
        console.log(req.body)

        const updatedOffer = await Offer.findByIdAndUpdate(req.body.id, {
            title,
            discountPercentage,
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
};

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

