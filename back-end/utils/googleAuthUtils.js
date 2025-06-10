const { google } = require('googleapis');
const GoogleToken = require('../models/googleTokenModel');
const AppError = require('../utils/appError');

const ALL_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
];

async function loadSavedCredentialsIfExist(userId, scopes = ALL_SCOPES) {
  const tokenDoc = await GoogleToken.findOne({
    userId,
    scopes: { $all: scopes },
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
    return client;
  }
  return null;
}

async function saveCredentials(client, userId, scopes = ALL_SCOPES) {
  await GoogleToken.findOneAndUpdate(
    { userId, scopes: { $all: scopes } },
    {
      userId,
      scopes,
      accessToken: client.credentials.access_token,
      refreshToken: client.credentials.refresh_token,
      expiryDate: client.credentials.expiry_date,
      updatedAt: Date.now(),
    },
    { upsert: true, new: true }
  );
}

async function authorize(userId, scopes = ALL_SCOPES) {
  let client = await loadSavedCredentialsIfExist(userId, scopes);
  if (client) return client;

  client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  throw new AppError('Cần xác thực. Vui lòng truy cập: ' + authUrl, 401);
}

module.exports = { authorize, loadSavedCredentialsIfExist, saveCredentials };
