const User = require('../models/userModel');

// Middleware function to check if the user is logged in and not blocked
const checkSession = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user._id);
            if (user && !user.isBlocked) {
                req.user = user;
                next();
            } else {
                // If user is blocked or not found, destroy their session and redirect to login
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Error destroying session:', err);
                    }
                    res.redirect("/auth/login?blocked=true");
                });
            }
        } catch (err) {
            console.error('Error checking user status:', err);
            res.redirect("/auth/login");
        }
    } else {
        // If user is not logged in, redirect to the login page
        res.redirect("/auth/login");
    }
};

// Middleware function to check if the user is already logged in
const isLogin = (req, res, next) => {
    if (req.session.user) {
        res.redirect("/user/home");
    } else {
        // If user is not logged in, proceed to the next middleware or route handler
        next();
    }
};

// Export the middleware functions for use in other parts of the application
module.exports = { checkSession, isLogin };

