const nodemailer = require('nodemailer');
const Email = require('./models/Email'); // Giả sử model Email đã được định nghĩa

const sendMail = async (emailDoc) => {
  // Cấu hình email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Tài khoản Google cố định (ví dụ: no-reply@yourapp.com)
      pass: process.env.EMAIL_PASSWORD, // App Password của tài khoản
    },
  });

  // Thực hiện gửi email
  const mailOptions = {
    from: process.env.EMAIL_USER, // Người gửi cố định từ biến môi trường
    to: emailDoc.recipients.map((r) => r.email).join(','), // Danh sách người nhận
    subject: emailDoc.subject, // Tiêu đề từ document
    text: emailDoc.body.text, // Nội dung văn bản từ document
    html: emailDoc.body.html, // Nội dung HTML từ document (nếu có)
  };

  try {
    // Gửi email
    await transporter.sendMail(mailOptions);

    // Cập nhật trạng thái sau khi gửi thành công
    await Email.updateOne(
      { _id: emailDoc._id },
      {
        $set: {
          status: 'sent',
          'recipients.$[].status': 'sent',
          sentAt: new Date(),
        },
      }
    );

    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    // Cập nhật trạng thái nếu gửi thất bại
    await Email.updateOne(
      { _id: emailDoc._id },
      {
        $set: {
          status: 'failed',
          'recipients.$[].status': 'failed',
          error: error.message,
        },
      }
    );

    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = sendMail;
