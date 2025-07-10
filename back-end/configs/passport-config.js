const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');
const GoogleToken = require('../models/googleTokenModel');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_LOGIN_REDIRECT_URI || '/auth/google/login/callback',
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/meetings.space.created',
        'https://www.googleapis.com/auth/calendar',
      ],
    },
    async (accessToken, refreshToken, tokens, profile, done) => {
      try {
        console.log('Google Profile:', {
          googleId: profile.id,
          email: profile.emails[0].value,
          displayName: profile.displayName,
        });

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          const existingUser = await User.findOne({
            email: profile.emails[0].value,
            isDeleted: false,
          });
          console.log(
            'Existing User:',
            existingUser ? existingUser.email : null
          );
          if (existingUser) {
            return done(null, false, {
              message:
                'Email already registered. Please login with your credentials and link your Google account from your profile.',
            });
          }
          user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value,
            fullname: profile.displayName,
            avatar: profile.photos[0]?.value,
            username: profile.emails[0].value.split('@')[0],
          });
        }

        const services = [
          {
            service: 'calendar',
            scopes: ['https://www.googleapis.com/auth/calendar'],
          },
          {
            service: 'drive',
            scopes: [
              'https://www.googleapis.com/auth/drive.file',
              'https://www.googleapis.com/auth/drive.metadata.readonly',
            ],
          },
          {
            service: 'meet',
            scopes: ['https://www.googleapis.com/auth/meetings.space.created'],
          },
        ];

        for (const { service, scopes } of services) {
          await GoogleToken.findOneAndUpdate(
            { userId: user._id, service },
            {
              userId: user._id,
              service,
              scopes,
              accessToken: accessToken || null,
              refreshToken: refreshToken || null,
              expiryDate: tokens.expiry_date || Date.now() + 3600 * 24 * 1000, // 24 hours
              status: 'active',
            },
            { upsert: true, new: true }
          );
        }

        console.log('Selected User:', user.email);
        done(null, user);
      } catch (err) {
        console.error('Google Strategy error:', err);
        done(err, null);
      }
    }
  )
);

// Separate strategy for linking Google account to existing user
passport.use(
  'google-link',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_LINK_REDIRECT_URI ||
        `${process.env.BACKEND_URL}/auth/google/link/callback`,
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/meetings.space.created',
        'https://www.googleapis.com/auth/calendar',
      ],
    },
    async (accessToken, refreshToken, tokens, profile, done) => {
      try {
        console.log('Google Link Profile:', {
          googleId: profile.id,
          email: profile.emails[0].value,
          displayName: profile.displayName,
        });

        // For linking, we just return the Google profile data
        // The actual linking logic is handled in the controller
        const googleUser = {
          googleId: profile.id,
          email: profile.emails[0].value,
          fullname: profile.displayName,
          avatar: profile.photos[0]?.value,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
        };

        done(null, googleUser);
      } catch (err) {
        console.error('Google Link Strategy error:', err);
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
