const { google } = require('googleapis');
const GoogleToken = require('../models/googleTokenModel');
const AppError = require('../utils/appError');

const SERVICE_SCOPES = {
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  meet: ['https://www.googleapis.com/auth/meetings.space.created'],
  calendar: ['https://www.googleapis.com/auth/calendar'],
};

const ALL_SCOPES = Object.values(SERVICE_SCOPES).flat();

const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 3600 * 1000, // 1 hour in milliseconds
  REFRESH_TOKEN: 180 * 24 * 3600 * 1000, // 180 days in milliseconds
  REFRESH_BEFORE: 5 * 60 * 1000, // Refresh 5 minutes before expiry
};

async function loadSavedCredentialsIfExist(userId, service, requiredScopes) {
  const tokenDoc = await GoogleToken.findOne({
    userId,
    service,
    scopes: { $all: requiredScopes },
    status: 'active',
  });

  if (tokenDoc) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({
      access_token: tokenDoc.accessToken,
      refresh_token: tokenDoc.refreshToken,
      expiry_date: tokenDoc.expiryDate,
    });

    if (tokenDoc.expiryDate && tokenDoc.expiryDate < Date.now()) {
      try {
        const { credentials } = await client.refreshAccessToken();
        await GoogleToken.updateOne(
          { userId, service },
          {
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date,
            updatedAt: Date.now(),
          }
        );
        client.setCredentials(credentials);
      } catch (error) {
        // Nếu refresh token thất bại, đánh dấu token là invalid và yêu cầu xác thực lại
        await GoogleToken.updateOne(
          { userId, service },
          {
            status: 'invalid',
            updatedAt: Date.now(),
          }
        );

        // Tạo URL xác thực mới
        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          scope: tokenDoc.scopes,
          prompt: 'consent',
        });

        throw new AppError(
          'Token đã hết hạn, vui lòng xác thực lại: ' + authUrl,
          401
        );
      }
    }
    return client;
  }
  return null;
}

async function saveCredentials(client, userId, service, scopes) {
  const existingToken = await GoogleToken.findOne({ userId, service });
  const now = Date.now();
  const tokenData = {
    accessToken: client.credentials.access_token,
    refreshToken: client.credentials.refresh_token,
    expiryDate: now + TOKEN_EXPIRY.ACCESS_TOKEN, // Force 1 hour expiry
    scopes: Array.from(new Set([...(existingToken?.scopes || []), ...scopes])),
    updatedAt: now,
    status: 'active',
    lastRefreshed: now,
    refreshTokenExpiryDate: now + TOKEN_EXPIRY.REFRESH_TOKEN,
  };

  if (existingToken) {
    // Keep existing refresh token if new one isn't provided
    if (!tokenData.refreshToken && existingToken.refreshToken) {
      tokenData.refreshToken = existingToken.refreshToken;
      tokenData.refreshTokenExpiryDate = existingToken.refreshTokenExpiryDate;
    }

    await GoogleToken.updateOne({ userId, service }, { $set: tokenData });
  } else {
    await GoogleToken.create({
      userId,
      service,
      ...tokenData,
    });
  }
}

async function authorize(userId, service, scopes) {
  try {
    console.log(
      '[googleAuthUtils.js][authorize] Kiểm tra token cho user:',
      userId,
      'service:',
      service
    );
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const tokenDoc = await GoogleToken.findOne({
      userId,
      service,
      status: 'active',
    });
    if (!tokenDoc) {
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force consent screen to ensure we get refresh token
      });
      console.log(
        '[googleAuthUtils.js][authorize] Không tìm thấy token, yêu cầu xác thực lại:',
        authUrl
      );
      throw new AppError(
        'Token không tồn tại hoặc đã bị thu hồi. Vui lòng xác thực lại: ' +
          authUrl,
        401
      );
    }
    // Check refresh token expiry
    const now = Date.now();
    const refreshTokenExpired =
      tokenDoc.refreshTokenExpiryDate && tokenDoc.refreshTokenExpiryDate < now;
    if (refreshTokenExpired) {
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
      });
      await GoogleToken.updateOne({ _id: tokenDoc._id }, { status: 'expired' });
      console.log(
        '[googleAuthUtils.js][authorize] Refresh token đã hết hạn, yêu cầu xác thực lại:',
        authUrl
      );
      throw new AppError(
        'Refresh token đã hết hạn. Vui lòng xác thực lại: ' + authUrl,
        401
      );
    }
    client.setCredentials({
      access_token: tokenDoc.accessToken,
      refresh_token: tokenDoc.refreshToken,
      expiry_date: tokenDoc.expiryDate,
    });
    // Check if token will expire soon (within 5 minutes)
    const willExpireSoon =
      tokenDoc.expiryDate - now < TOKEN_EXPIRY.REFRESH_BEFORE;
    if (willExpireSoon) {
      if (!tokenDoc.refreshToken) {
        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          prompt: 'consent',
        });
        await GoogleToken.updateOne(
          { _id: tokenDoc._id },
          { status: 'expired' }
        );
        console.log(
          '[googleAuthUtils.js][authorize] Token sắp hết hạn và không có refresh token, yêu cầu xác thực lại:',
          authUrl
        );
        throw new AppError(
          'Token sắp hết hạn và không có refresh token. Vui lòng xác thực lại: ' +
            authUrl,
          401
        );
      }
      try {
        console.log(
          '[googleAuthUtils.js][authorize] Token sắp hết hạn, tiến hành refresh...'
        );
        const { credentials } = await client.refreshAccessToken();
        await GoogleToken.updateOne(
          { _id: tokenDoc._id },
          {
            accessToken: credentials.access_token,
            expiryDate: now + TOKEN_EXPIRY.ACCESS_TOKEN,
            status: 'active',
            lastRefreshed: now,
            updatedAt: now,
          }
        );
        client.setCredentials({
          ...credentials,
          expiry_date: now + TOKEN_EXPIRY.ACCESS_TOKEN,
        });
        console.log(
          '[googleAuthUtils.js][authorize] Đã refresh token thành công cho user:',
          userId,
          'service:',
          service
        );
      } catch (refreshError) {
        console.error(
          '[googleAuthUtils.js][authorize] Lỗi refresh token:',
          refreshError
        );
        await GoogleToken.updateOne(
          { _id: tokenDoc._id },
          { status: 'expired' }
        );
        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          prompt: 'consent',
        });
        throw new AppError(
          'Token refresh thất bại. Vui lòng xác thực lại: ' + authUrl,
          401
        );
      }
    }
    // Check for required scopes
    const missingScopes = scopes.filter(
      (scope) => !tokenDoc.scopes.includes(scope)
    );
    if (missingScopes.length > 0) {
      console.log(
        '[googleAuthUtils.js][authorize] Token thiếu scope:',
        missingScopes,
        'user:',
        userId,
        'service:',
        service
      );
      const allScopes = Array.from(new Set([...tokenDoc.scopes, ...scopes]));
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: allScopes,
        prompt: 'consent',
      });
      throw new AppError(
        'Cần xác thực thêm quyền. Vui lòng truy cập: ' + authUrl,
        401
      );
    }
    return client;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error(
      '[googleAuthUtils.js][authorize] Lỗi xác thực Google:',
      error
    );
    throw new AppError('Xác thực Google thất bại: ' + error.message, 500);
  }
}

async function getCombinedAuthUrl(
  userId,
  services = Object.keys(SERVICE_SCOPES)
) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const combinedScopes = Array.from(
    new Set(services.flatMap((service) => SERVICE_SCOPES[service] || []))
  );

  const existingTokens = await GoogleToken.find({
    userId,
    service: { $in: services },
  });
  const existingScopes = existingTokens.flatMap((token) => token.scopes);
  const missingScopes = combinedScopes.filter(
    (scope) => !existingScopes.includes(scope)
  );

  if (missingScopes.length === 0) {
    return null;
  }

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: combinedScopes,
    prompt: 'consent',
  });

  return authUrl;
}

module.exports = {
  authorize,
  loadSavedCredentialsIfExist,
  saveCredentials,
  getCombinedAuthUrl,
};
