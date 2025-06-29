const crypto = require("crypto");
const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
// Quản lý thông tin người dùng
const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
    },
    username: {
      type: String,
      required: false, //Không bắt buộc với người dùng đăng nhập bằng OAuth
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Vui lòng cung cấp email hợp lệ"],
    },
    password: {
      type: String,
      required: false, //Không bắt buộc với người dùng đăng nhập bằng OAuth
    },
    googleId: {
      //Lưu ID duy nhất của người dùng từ Google để liên kết tài khoản Google với tài khoản trong hệ thống
      type: String,
      unique: true,
      sparse: true, // Cho phép null, chỉ lưu khi đăng nhập qua Google
    },
    avatar: String,
    role: {
      type: String,
      enum: ["userSystem", "adminSystem"],
      default: "userSystem",
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Skill",
      },
    ],
    about: {
      type: String,
    },
    experience: {
      type: String,
    },
    yearOfExperience: {
      type: Number,
      min: [0, "Năm kinh nghiệm không thể nhỏ hơn 0"],
      default: 0,
    },
    availability: {
      status: {
        type: String,
        enum: ["available", "busy"],
        default: "available",
      },
      willingToJoin: {
        type: Boolean,
        default: true,
      },
    },
    expectedWorkDuration: {
      min: {
        type: Number,
        min: [0, "Thời gian làm việc tối thiểu không thể nhỏ hơn 0"],
        default: 0,
      },
      max: {
        type: Number,
        min: [0, "Thời gian làm việc tối đa không thể nhỏ hơn 0"],
        default: 0,
      },
      unit: {
        type: String,
        enum: ["hours", "days", "weeks", "months"],
        default: "hours",
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

//Mã hoá mật khẩu trước khi save vào database
//Nếu không có password thì bỏ qua bước mã hoá - khi đăng nhập bằng OAuth
userSchema.pre("save", async function (next) {
  //Only run this function if password was actually modified
  if (!this.isModified("password") || !this.password) {
    //neu password chua duoc sua doi thi chuyen sang middleware tiep theo
    return next();
  }
  //nguoc lai, hash password va save
  //Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  //Delete passwordConfirm field
  this.passwordConfirm = undefined; //ko muon save pass nay vao database nua nen de lai la undefined
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) {
    return next();
    //Nếu ko thay đổi mật khẩu thì sẽ không thay đổi thông tin của passwordChangedAt
  }

  this.passwordChangedAt = Date.now() - 1000; //Đảm bảo JWT luôn được tạo sau 1 giây kể từ khi mật khẩu thay đổi, tránh việc tạo token mất nhiều thời gian
  /*
  nếu một token JWT được tạo ra trước khi mật khẩu của người dùng được thay đổi, 
  nhưng sau đó người dùng thực hiện đăng nhập bằng token đó sau khi mật khẩu đã thay đổi, 
  họ vẫn có thể truy cập vào hệ thống mà không cần phải nhập mật khẩu mới.

  Để ngăn chặn tình trạng này, bạn cần đảm bảo rằng mỗi khi mật khẩu của người dùng thay đổi, 
  tất cả các token JWT hiện có của họ đều trở nên không hợp lệ. 
  Cách thường được sử dụng để làm điều này là thông qua việc cập nhật trường passwordChangedAt 
  và kiểm tra thời gian này khi xác thực token. Nếu một token được tạo ra trước thời điểm passwordChangedAt, 
  nó sẽ không còn hợp lệ và người dùng sẽ phải đăng nhập lại bằng mật khẩu mới.
  */
  next();
});

//Tạo thêm method để tiện cho việc sử dụng trực tiếp từ model
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

//
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    console.log(
      "thoi gian thay doi pass: " + changedTimestamp,
      "thoi gian expire jwt: " + JWTTimestamp
    );
    return changedTimestamp > JWTTimestamp;
    //Nếu thời gian thay đổi mật khẩu lớn hơn thời gian phát hành JWT,
    //trả về true, nghĩa là mật khẩu đã được thay đổi
    //sau khi JWT được phát hành và JWT này nên bị coi là không hợp lệ.
  }
  //False means not changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // Tạo resetToken (cái cần gửi tới user) để reset password
  const resetToken = crypto.randomBytes(32).toString("hex"); //32 characters
  //Sau đó hash token đó và lưu resetToken đã được hash, vào csdl để khi user nhấn vào đường dẫn của resetToken
  //Thì sẽ lấy hashed token trong csdl ra để đối chiếu với resetToken
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

//validate startDate <= endDate
// userSchema.pre('validate', function(next) {
//   const d1 = this.expectedWorkDuration.startDate;
//   const d2 = this.expectedWorkDuration.endDate;
//   if (d1 && d2 && d1 > d2) {
//     this.invalidate(
//       'expectedWorkDuration.endDate',
//       'endDate must be greater than or equal to startDate'
//     );
//   }
//   next();
// });

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ yearOfExperience: 1 });
userSchema.index({ "availability.status": 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
