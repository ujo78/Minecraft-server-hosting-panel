const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AuthManager = require('./authManager');

const authManager = new AuthManager('./users.json');

module.exports = function (passport) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: '/auth/google/callback'
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Find or create user based on Google profile
                    // profile.id, profile.displayName, profile.emails[0].value
                    const user = await authManager.findOrCreateGoogleUser(profile);
                    done(null, user);
                } catch (err) {
                    console.error("Google Auth Error:", err);
                    done(err, null);
                }
            }
        )
    );

    // Serialize/Deserialize not strictly needed for pure JWT flow if we handle it manually
    // but Passport requires it for session support if we used sessions.
    // We will just pass the user object through.
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });
};
