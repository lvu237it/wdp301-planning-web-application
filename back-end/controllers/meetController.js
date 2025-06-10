const { SpacesServiceClient } = require('@google-apps/meet').v2;
const { authorize } = require('../utils/googleAuthUtils');

exports.createMeetSpace = async (
  req,
  scopes = ['https://www.googleapis.com/auth/meetings.space.created']
) => {
  try {
    const userId = req.user._id;
    const authClient = await authorize(userId, scopes);

    const meetClient = new SpacesServiceClient({ authClient });
    const [response] = await meetClient.createSpace({});
    const meetUrl = response.meetingUri;

    return meetUrl;
  } catch (error) {
    throw new AppError('Tạo Meet space thất bại: ' + error.message, 500);
  }
};
