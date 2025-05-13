class AppError extends Error {
  constructor(message, statusCode) {
    super(message); //tại sao không phải this.message = message
    //bởi vì extends từ lớp Error cho nên mọi lỗi sẽ được thông báo từ đó mà không phải truyền trực tiếp
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; //xác định có phải lỗi do vận hành hay không? - nếu ko thì lỗi do lập trình (programming error)

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
