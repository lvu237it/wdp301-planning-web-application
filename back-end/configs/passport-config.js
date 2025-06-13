// // // passport.use(
// // //   new GoogleStrategy(
// // //     {
// // //       clientID: process.env.GOOGLE_CLIENT_ID,
// // //       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
// // //       callbackURL: '/auth/google/callback',
// // //       scope: [
// // //         'profile',
// // //         'email',
// // //         'https://www.googleapis.com/auth/drive.file',
// // //         'https://www.googleapis.com/auth/drive.metadata.readonly',
// // //         'https://www.googleapis.com/auth/meetings.space.created',
// // //         'https://www.googleapis.com/auth/calendar',
// // //       ],
// // //     },
// // //     async (accessToken, refreshToken, profile, done) => {
// // //       try {
// // //         // Tìm hoặc tạo người dùng dựa trên email hoặc googleId
// // //         let user = await User.findOne({ googleId: profile.id });
// // //         if (!user) {
// // //           user = await User.findOne({ email: profile.emails[0].value });
// // //           if (!user) {
// // //             user = await User.create({
// // //               googleId: profile.id,
// // //               email: profile.emails[0].value,
// // //               fullname: profile.displayName,
// // //               avatar: profile.photos[0]?.value,
// // //               username: profile.emails[0].value.split('@')[0],
// // //             });
// // //           } else {
// // //             user.googleId = profile.id;
// // //             await user.save();
// // //           }
// // //         }

// // //         // Danh sách các dịch vụ và scope tương ứng
// // //         const services = [
// // //           {
// // //             service: 'calendar',
// // //             scopes: ['https://www.googleapis.com/auth/calendar'],
// // //           },
// // //           {
// // //             service: 'drive',
// // //             scopes: [
// // //               'https://www.googleapis.com/auth/drive.file',
// // //               'https://www.googleapis.com/auth/drive.metadata.readonly',
// // //             ],
// // //           },
// // //           {
// // //             service: 'meet',
// // //             scopes: ['https://www.googleapis.com/auth/meetings.space.created'],
// // //           },
// // //         ];

// // //         // Lưu token cho từng dịch vụ
// // //         for (const { service, scopes } of services) {
// // //           await GoogleToken.findOneAndUpdate(
// // //             { userId: user._id, service },
// // //             {
// // //               userId: user._id,
// // //               service,
// // //               scopes,
// // //               accessToken,
// // //               refreshToken,
// // //               expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
// // //               status: 'active',
// // //             },
// // //             { upsert: true }
// // //           );
// // //         }

// // //         done(null, user);
// // //       } catch (err) {
// // //         done(err, null);
// // //       }
// // //     }
// // //   )
// // // );

// // const passport = require('passport');
// // const GoogleStrategy = require('passport-google-oauth20').Strategy;
// // const User = require('../models/userModel');
// // const GoogleToken = require('../models/googleTokenModel');

// // passport.use(
// //   new GoogleStrategy(
// //     {
// //       clientID: process.env.GOOGLE_CLIENT_ID,
// //       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
// //       callbackURL:
// //         process.env.GOOGLE_LOGIN_REDIRECT_URI || '/auth/google/login/callback',
// //       scope: [
// //         'profile',
// //         'email',
// //         'https://www.googleapis.com/auth/drive.file',
// //         'https://www.googleapis.com/auth/drive.metadata.readonly',
// //         'https://www.googleapis.com/auth/meetings.space.created',
// //         'https://www.googleapis.com/auth/calendar',
// //       ],
// //     },
// //     async (accessToken, refreshToken, profile, tokens, done) => {
// //       try {
// //         console.log(
// //           ' process.env.GOOGLE_LOGIN_REDIRECT_URI',
// //           process.env.GOOGLE_LOGIN_REDIRECT_URI
// //         );

// //         // Tìm hoặc tạo người dùng dựa trên email hoặc googleId
// //         let user = await User.findOne({ googleId: profile.id });
// //         if (!user) {
// //           user = await User.findOne({ email: profile.emails[0].value });
// //           if (!user) {
// //             user = await User.create({
// //               googleId: profile.id,
// //               email: profile.emails[0].value,
// //               fullname: profile.displayName,
// //               avatar: profile.photos[0]?.value,
// //               username: profile.emails[0].value.split('@')[0],
// //             });
// //           } else {
// //             user.googleId = profile.id;
// //             await user.save();
// //           }
// //         }

// //         // Danh sách các dịch vụ và scope tương ứng
// //         const services = [
// //           {
// //             service: 'calendar',
// //             scopes: ['https://www.googleapis.com/auth/calendar'],
// //           },
// //           {
// //             service: 'drive',
// //             scopes: [
// //               'https://www.googleapis.com/auth/drive.file',
// //               'https://www.googleapis.com/auth/drive.metadata.readonly',
// //             ],
// //           },
// //           {
// //             service: 'meet',
// //             scopes: ['https://www.googleapis.com/auth/meetings.space.created'],
// //           },
// //         ];

// //         // Lưu token cho từng dịch vụ
// //         for (const { service, scopes } of services) {
// //           await GoogleToken.findOneAndUpdate(
// //             { userId: user._id, service },
// //             {
// //               userId: user._id,
// //               service,
// //               scopes,
// //               accessToken,
// //               refreshToken,
// //               expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
// //               status: 'active',
// //             },
// //             { upsert: true }
// //           );
// //         }

// //         done(null, user);
// //       } catch (err) {
// //         done(err, null);
// //       }
// //     }
// //   )
// // );

// // passport.serializeUser((user, done) => {
// //   done(null, user.id);
// // });

// // passport.deserializeUser(async (id, done) => {
// //   try {
// //     const user = await User.findById(id);
// //     done(null, user);
// //   } catch (err) {
// //     done(err, null);
// //   }
// // });

// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/userModel');
// const GoogleToken = require('../models/googleTokenModel');

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL:
//         process.env.GOOGLE_LOGIN_REDIRECT_URI || '/auth/google/login/callback',
//       scope: [
//         'profile',
//         'email',
//         'https://www.googleapis.com/auth/drive.file',
//         'https://www.googleapis.com/auth/drive.metadata.readonly',
//         'https://www.googleapis.com/auth/meetings.space.created',
//         'https://www.googleapis.com/auth/calendar',
//       ],
//     },
//     async (accessToken, refreshToken, tokens, profile, done) => {
//       try {
//         console.log('Google Profile:', {
//           googleId: profile.id,
//           email: profile.emails[0].value,
//           displayName: profile.displayName,
//         });

//         // Tìm người dùng bằng googleId
//         let user = await User.findOne({ googleId: profile.id });
//         if (!user) {
//           // Nếu không tìm thấy, kiểm tra email
//           const existingUser = await User.findOne({
//             email: profile.emails[0].value,
//             isDeleted: false,
//           });
//           console.log('Existing User:', existingUser);
//           if (existingUser) {
//             // Nếu email đã tồn tại, trả lỗi thay vì cập nhật googleId
//             return done(null, false, {
//               message:
//                 'Email already registered. Please link Google account manually.',
//             });
//           }
//           // Tạo người dùng mới
//           user = await User.create({
//             googleId: profile.id,
//             email: profile.emails[0].value,
//             fullname: profile.displayName,
//             avatar: profile.photos[0]?.value,
//             username: profile.emails[0].value.split('@')[0],
//           });
//         }

//         // Lưu Google tokens
//         const services = [
//           {
//             service: 'calendar',
//             scopes: ['https://www.googleapis.com/auth/calendar'],
//           },
//           {
//             service: 'drive',
//             scopes: [
//               'https://www.googleapis.com/auth/drive.file',
//               'https://www.googleapis.com/auth/drive.metadata.readonly',
//             ],
//           },
//           {
//             service: 'meet',
//             scopes: ['https://www.googleapis.com/auth/meetings.space.created'],
//           },
//         ];

//         for (const { service, scopes } of services) {
//           await GoogleToken.findOneAndUpdate(
//             { userId: user._id, service },
//             {
//               userId: user._id,
//               service,
//               scopes,
//               accessToken: accessToken || null,
//               refreshToken: refreshToken || null,
//               expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
//               status: 'active',
//             },
//             { upsert: true, new: true }
//           );
//         }

//         console.log('Selected User:', user.email);
//         done(null, user);
//       } catch (err) {
//         console.error('Google Strategy error:', err);
//         done(err, null);
//       }
//     }
//   )
// );

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await User.findById(id);
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
// });

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
              expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
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
