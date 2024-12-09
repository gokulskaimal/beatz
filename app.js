const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const adminRoutes = require("./routes/adminRoutes");
const methodOverride = require('method-override');
const userRoutes = require('./routes/userRoutes')
const passport = require('./utils/passport');
const app = express();
const nocache = require("nocache");
require('dotenv').config();
app.use(nocache()); 
app.use(methodOverride('_method'));
   
  
// Connect to MongoDB 
mongoose.connect('mongodb://127.0.0.1:27017/beatz')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error(err));  
 

// Middleware 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
})); 
 

app.use((req, res, next) => {
  if (req.session.alert) { 
    res.locals.alert = req.session.alert;
    delete req.session.alert;
  }
  next();
});


// Initialize Passport 
app.use(passport.initialize());
app.use(passport.session()); 


// View engine   
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 


// Middleware to initialize res.locals.alert
app.use((req, res, next) => {
  res.locals.alert = null; // Set a default value for the alert
  next();
});


// Middleware to initialize res.locals.alert
app.use((req, res, next) => {
  res.locals.alert = null; // Set a default value for the alert
  next();
});
 

// Routes    
app.use('/auth', authRoutes); 
app.use("/admin", adminRoutes);
app.use("/user", userRoutes)

      
// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/auth/home`));
  

  