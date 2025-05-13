const nodemailer = require('nodemailer');

const sendMail = async ({ email, html }) => {
    // Cấu hình email
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Hoặc dịch vụ email khác
        auth: {
            user: process.env.EMAIL_USER,  // Email của bạn
            pass: process.env.EMAIL_PASSWORD,  // Mật khẩu email
        },
    });

    // Thực hiện gửi email
    const mailOptions = {
        from: process.env.EMAIL_USER,  // Người gửi
        to: email,                     // Người nhận
        subject: 'Reset Password',     // Tiêu đề email
        html: html,                    // Nội dung email
    };

    // Gửi email và trả về kết quả
    await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
