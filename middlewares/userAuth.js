// Middleware function to check if the user is logged in
const checkSession = (req, res, next) => {
    // Check if there is a user object in the session
    if (req.session.user) {
        // If user is logged in, proceed to the next middleware or route handler
        next();
    } else {
        // If user is not logged in, redirect to the login page
        res.redirect("/auth/login");
    }
};

// Middleware function to check if the user is already logged in
const isLogin = (req, res, next) => {
    // Check if there is a user object in the session
    if (req.session.user) {
        // If user is logged in, redirect to the home page
        res.redirect("/user/home");
    } else {
        // If user is not logged in, proceed to the next middleware or route handler
        next();
    }
};

// Export the middleware functions for use in other parts of the application
module.exports = { checkSession, isLogin };
