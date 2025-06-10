const mongoose = require('mongoose');
//Mongoose là 1 thư viện ODM (mô hình hoá dữ liệu đối tượng) cho mongoDB và Node
//Cho phép nhanh chóng và đơn giản hoá việc phát triển, tương tác với cơ sở dữ liệu mongoDB dễ dàng hơn

//Xử lý các ngoại lệ không thể catch bằng các middleware xử lý hay các trình catch khác
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception BOOM Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const dotenv = require('dotenv');
dotenv.config({
  //việc đọc các biến môi trường từ file .env xảy ra duy
  //1 lần, sau đó nó nằm trong process và có thể truy cập ở tất cả mọi nơi
  path: './.env',
});
const app = require('./app');

//create connection
const DBRecipesSharingWebApp = process.env.DATABASE_URI;
mongoose
  .connect(DBRecipesSharingWebApp) //this is a promise
  .then((con) => {
    // console.log(con.connections);
    console.log('DB connection successful');
    console.log('📌 Database đang dùng:', mongoose.connection.name);
  });

// console.log(app.get('env')); //env - environment: 'development'
// Biến môi trường 'env' là biến toàn cục được sử dụng để xác định môi trường mà nodejs đang chạy

// console.log(process.env);

/* ---------- Note ----------
  Nên giữ logic ứng dụng (application logic) trong Controller
  và giữ logic nghiệp vụ (business logic) trong Model
  */

const port = process.env.PORT;
// const port = 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

//"Tấm lưới an toàn" cuối cùng để xử lý các lỗi không được handle
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('Unhandler Rejection BOOM Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
