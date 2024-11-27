// Middleware function to check if the admin is logged in
const checkSession = (req, res, next) => {
    // Check if there is an admin object in the session
    if (req.session.admin) {
        // If admin is logged in, proceed to the next middleware or route handler
        next();
    } else {
        // If admin is not logged in, redirect to the admin login page
        res.redirect('/admin/login');
    }
};

// Middleware function to check if the admin is already logged in
const isLogin = (req, res, next) => {
    // Check if there is an admin object in the session
    if (req.session.admin) {
        // If admin is logged in, redirect to the admin home page
        res.redirect('/admin/dashboard');
    } else {
        // If admin is not logged in, proceed to the next middleware or route handler
        next();
    }
};

// Export the middleware functions for use in other parts of the application
module.exports = { checkSession, isLogin };