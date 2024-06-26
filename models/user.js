const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required!"],
  },
  lastName: {
    type: String,
    required: [true, "Last name is required!"],
  },
  avatar: {
    type: String,
  },
  email: {
    type: String,
    required: [true, "Email is required!"],
    validate: {
      validator: function (email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },
      message: (props) => `Email \b${props.value} is invalid`,
    },
  },
  password: {
    type: String,
  },
  passwordConfirm: {
    type: String,
  },
  passwordChangedAt: {
    type: Date,
  },
  passwordResetToken: {
    type: String,
  },
  passwordResetExpires: {
    type: Date,
  },
  createdAt: {
    type: Date,
  },
  updatedAt: {
    type: Date,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otp_expiry_time: {
    type: Date,
  },
  socket_id: {
    type: String,
  },
  friends: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  ],
  status: {
    type: String,
    enum: ["Online", "Offline"]
  }
});

userSchema.pre("save", async function (next) {
  // Only run this function if OTP is actually modified
  if (!this.isModified("otp") || !this.otp) return next();

  console.log("OTP Value:", this.otp);

  // Convert the OTP to a string before hashing
  const otpString = this.otp.toString();

  // Hash the OTP with the cost of 12
  this.otp = await bcrypt.hash(otpString, 12);

  next();
});
userSchema.pre("save", async function (next) {
  // Only run this fxn if password is actually modified
  if (!this.isModified("password")) return next();

  // Hash the password with the cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (
  canditatePassword,
  userPassword
) {
  return await bcrypt.compare(canditatePassword, userPassword);
};

userSchema.methods.correctOTP = async function (candidateOTP) {
  if (!candidateOTP) return false; // Handle case where candidateOTP is undefined or null
  return await bcrypt.compare(String(candidateOTP), String(this.otp));
};
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  return resetToken;
};

userSchema.methods.changedPasswordAfter = function (timestamp) {
  return timestamp < this.passwordChangedAt;
};

const User = new mongoose.model("User", userSchema);
module.exports = User;
