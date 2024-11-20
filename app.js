const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const adminRoutes = require("./routes/adminRoutes");
const methodOverride = require('method-override');

const app = express();
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
  
// View engine  
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

   
// Routes   
app.use('/auth', authRoutes);  
app.use("/admin", adminRoutes);
app.get("/home" ,(req,res) => {
  res.render("pages/home")
})
app.get("/product" ,(req,res)=>{
  res.render("pages/product")
})
 


// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
     