require('dotenv').config();
const nodemailer = require('nodemailer');


// Cấu hình transporter (dùng Gmail hoặc SMTP service khác)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USERNAME, // ví dụ: your_email@gmail.com
    pass: process.env.EMAIL_PASSWORD, // dùng App Password nếu 2FA
  },
});
// Hàm gửi email
const sendEmail = async (to, subject, htmlContent) => {

  const mailOptions = {
    from: `"WebPlanPro" <${process.env.EMAIL_USERNAME}>`,
    to,
    subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.response}`);
    return info;
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    throw error;
  }
};

module.exports = sendEmail;
