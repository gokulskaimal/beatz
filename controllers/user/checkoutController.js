const { format } = require('date-fns');
const Cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const User = require("../../models/userModel");
const Orders = require("../../models/orderModel");
const Product = require("../../models/productModel");

exports.getCheckout = async (req, res) => {
    try {
        const userId = req.user._id;
        const addresses = await Address.find({ userId });
        const cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.render("user/checkout", { addresses, cart: null, totalPrice: 0, totalDiscountPrice: 0, discount: 0, totalItems: 0 });
        }

        cart.items = cart.items.filter(item => item.product && !item.product.isBlocked);

        let totalPrice = 0;
        let totalDiscountPrice = 0; 
        let totalItems = 0;

        cart.items.forEach(item => {
            const itemTotalPrice = item.product.price * item.quantity;
            const itemTotalDiscountPrice = item.product.discountPrice * item.quantity;

            totalPrice += itemTotalPrice;
            totalDiscountPrice += itemTotalDiscountPrice;
            totalItems += item.quantity;
        });

        const discount = totalPrice - totalDiscountPrice;

        res.render("user/checkout", { addresses, cart, totalPrice, totalDiscountPrice, discount, totalItems });
    } catch (error) {
        console.error("Get checkout error: ", error);
        res.status(500).render("error", { message: "An error occurred while processing your request." });
    }
};

// exports.placeOrder = async (req, res) => {
//     try {
//         const { addressId, paymentMethod } = req.body;
//         const userId = req.user._id;

//         const user = await User.findById(userId);
//         const shippingAddress = await Address.findById(addressId);
//         if (!shippingAddress) {
//             return res.status(404).json({ message: "Address not found" });
//         }

//         const cart = await Cart.findOne({ userId }).populate('items.product');
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).json({ message: "Your cart is empty" });
//         }

//         const items = cart.items.filter(item => item.product && !item.product.isBlocked);

//         let totalAmount = 0;
//         let discountPrice = 0;

//         const orderItems = await Promise.all(items.map(async (item) => {
//             const product = item.product;

//             if (product.stock < item.quantity) {
//                 throw new Error(`Insufficient stock for product ${product.product_name}. Only ${product.stock} items left.`);
//             }

//             const subtotal = product.discountPrice * item.quantity;
//             discountPrice += subtotal;
//             const originalPrice = product.price * item.quantity;
//             totalAmount += originalPrice;

//             return {
//                 productId: product._id,
//                 productName: product.product_name,
//                 quantity: item.quantity,
//                 price: product.price,
//                 discountPrice: product.discountPrice,
//                 subtotal,
//                 status: 'Pending'
//             };
//         }));

//         const discount = totalAmount - discountPrice;

//         const order = new Orders({
//             customer: {
//                 customerId: userId,
//                 customerName: user.name,
//                 customerEmail: user.email,
//                 shippingAddress: {
//                     name: shippingAddress.name,
//                     addressType: shippingAddress.addressType,
//                     address: shippingAddress.street,
//                     city: shippingAddress.city,
//                     state: shippingAddress.state,
//                     pincode: shippingAddress.zipCode,
//                     phone: shippingAddress.phone
//                 }
//             },
//             items: orderItems,
//             payment: {
//                 paymentMethod,
//                 paymentStatus: 'Pending',
//                 totalAmount,
//                 discount,
//                 discountPrice
//             },
//         });

//         const savedOrder = await order.save();

//         await Promise.all(orderItems.map(async (item) => {
//             await Product.findByIdAndUpdate(item.productId, {
//                 $inc: { stock: -item.quantity }
//             });
//         }));

//         cart.items = [];
//         await cart.save();

//         res.status(201).json({ orderId: savedOrder._id });
//     } catch (error) {
//         console.error("Place order error: ", error);
//         res.status(500).json({ message: error.message || 'Failed to place order' });
//     }
// };

// exports.getConfirmation = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
//         const confirmedOrder = await Orders.findById(orderId).populate('items.productId');

//         if (!confirmedOrder) {
//             return res.status(404).render("error", { message: "Order not found" });
//         }

//         confirmedOrder.formattedDate = format(confirmedOrder.createdAt, 'MMMM dd, yyyy');

//         res.render('user/orderConfirmation', { confirmedOrder });
//     } catch (error) {
//         console.error("Get confirmation error: ", error);
//         res.status(500).render("error", { message: "An error occurred while processing your request." });
//     }
// };

