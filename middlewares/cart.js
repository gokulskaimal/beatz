// // middleware/cartMiddleware.js
// const Cart = require('../models/cartModel'); // Adjust the path as needed

// async function cartMiddleware(req, res, next) {
//   if (req.user) {
//     try {
//       const cart = await Cart.findOne({ userId: req.user._id });
//       if (cart) {
//         // Calculate the total quantity of items in the cart
//         const cartItemCount = cart.items.reduce((total, item) => total + item.quantity, 0);
//         res.locals.cartItemCount = cartItemCount;
//       } else {
//         res.locals.cartItemCount = 0;
//       }
//     } catch (error) {
//       console.error('Error fetching cart:', error);
//       res.locals.cartItemCount = 0;
//     }
//   } else {
//     res.locals.cartItemCount = 0;
//   }
//   next();
// }

// module.exports = cartMiddleware;