const cron = require('node-cron');
const Coupon = require('../models/couponModel');
const Offer = require('../models/offerModel');

// Run the cleanup task every day at midnight
cron.schedule('0 0 * * *', async () => {
  const currentDate = new Date();

  try {
    // Delete expired coupons
    const expiredCoupons = await Coupon.deleteMany({
      expiryDate: { $lt: currentDate }
    });

    console.log(`Deleted ${expiredCoupons.deletedCount} expired coupons`);

    // Delete expired offers
    const expiredOffers = await Offer.deleteMany({
      endDate: { $lt: currentDate }
    });

    console.log(`Deleted ${expiredOffers.deletedCount} expired offers`);
  } catch (error) {
    console.error('Error during cleanup of expired coupons and offers:', error);
  }
});