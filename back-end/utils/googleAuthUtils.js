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
        throw new AppError('Không thể làm mới token: ' + error.message, 401);
      }
    }
    return client;
  }
  return null;
}

async function saveCredentials(client, userId, service, scopes) {
  const existingToken = await GoogleToken.findOne({ userId, service });
  if (existingToken) {
    const updatedScopes = Array.from(
      new Set([...existingToken.scopes, ...scopes])
    );
    await GoogleToken.updateOne(
      { userId, service },
      {
        $set: {
          accessToken: client.credentials.access_token,
          refreshToken: client.credentials.refresh_token,
          expiryDate: client.credentials.expiry_date,
          scopes: updatedScopes,
          updatedAt: Date.now(),
          status: 'active',
        },
      }
    );
  } else {
    await GoogleToken.create({
      userId,
      service,
      scopes,
      accessToken: client.credentials.access_token,
      refreshToken: client.credentials.refresh_token,
      expiryDate: client.credentials.expiry_date,
      status: 'active',
    });
  }
}

async function authorize(userId, service, scopes) {
  // Đầu tiên kiểm tra xem có credentials đã lưu không
  let authClient = await loadSavedCredentialsIfExist(userId, service, scopes);
  if (authClient) {
    console.log('Found existing credentials for service:', service);
    return authClient;
  }

  // Nếu không tìm thấy token hoặc token không hợp lệ, kiểm tra token với scopes ít hơn
  const existingToken = await GoogleToken.findOne({
    userId,
    service,
    status: 'active',
  });

  if (existingToken) {
    console.log('Found existing token, checking scopes...');
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    client.setCredentials({
      access_token: existingToken.accessToken,
      refresh_token: existingToken.refreshToken,
      expiry_date: existingToken.expiryDate,
    });

    // Kiểm tra nếu token hết hạn và refresh
    if (existingToken.expiryDate && existingToken.expiryDate < Date.now()) {
      try {
        console.log('Token expired, refreshing...');
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
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh token:', error);
        throw new AppError('Không thể làm mới token: ' + error.message, 401);
      }
    }

    // Kiểm tra xem có tất cả scopes cần thiết không
    const missingScopes = scopes.filter(
      (scope) => !existingToken.scopes.includes(scope)
    );
    if (missingScopes.length > 0) {
      console.log('Missing scopes:', missingScopes);
      // Nếu thiếu scopes, thì cần re-authorize
      const allScopes = Array.from(
        new Set([...existingToken.scopes, ...scopes])
      );
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
  }

  // Nếu không có token nào, yêu cầu xác thực mới
  const newClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const authUrl = newClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  throw new AppError(
    'Cần xác thực Google API. Vui lòng truy cập: ' + authUrl,
    401
  );
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
