const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel'); // Your User model
require('dotenv').config();

console.log(process.env.GOOGLE_CALLBACK_URI)

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract email from Google profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: 'Google account does not have an email address' });
        }

        // Check if the user already exists
        const user = await User.findOne({ email });
        if (user) {
          if (user.isBlocked) {
            return done(null, false, { message: 'You are blocked. Contact support.' });
          }

          // Link Google account if not already linked
          if (!user.googleId ) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        }

        // Create a new user
        const newUser = new User({
          googleId: profile.id,
          firstName: profile.name?.givenName || '',
          lastName: profile.name?.familyName || '',
          email,
          isBlocked: false, // Default is not blocked
        });

        await newUser.save();
        return done(null, newUser);
      } catch (err) {
        console.error('Error during Google authentication:', err);
        return done(err, null);
      }
    }
  )
);

// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.id); // Store user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('Error during deserialization:', err);
    done(err, null);
  }
});

module.exports = passport;
