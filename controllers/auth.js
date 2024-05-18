const jwt = require("jsonwebtoken");
const User = require("../models/user");
const filterObj = require("../utils/filterObject");
const otpGenerator = require("otp-generator");
const crypto = require("crypto");
const { promisify } = require("util");
const mailService = require("../services/mailer");

const signToken = (userId) =>
jwt.sign({ userId }, process.env.CJ_POGI_SECRET_KEY);

exports.register = async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "email",
    "password"
  );
  //check if a verified user with the given email address
  const existing_user = await User.findOne({ email: email });
  if (existing_user && existing_user.verified) {
    res.status(400).json({
      status: "error",
      message: "Email is already existing.",
    });
    //console.log("test2")
  } else if (existing_user) {
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifiedOnly: true,
    });

    req.userId = existing_user._id;
    //console.log("simrekditoylutdit1")
    next();
  } else {
    const new_user = await User.create(filteredBody);
    //console.log("simrekditoylutdit2")
    req.userId = new_user._id;
    next();
  }
};
exports.sendOTP = async (req, res, next) => {
  const { userId } = req;
  // const new_otp = otpGenerator.generate(6, {
  //   lowerCaseAlphabets: false,
  //   upperCaseAlphabets: false,
  //   specialChars: false,
  // });

  const new_otp = "010724";


  const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10mins after otp is sent

  await User.findByIdAndUpdate(userId, {
    otp: new_otp,
    //otp_expiry_time,
  });

  // TODO Send Mail

  // mailService.sendEmail({
  //   from: "cjribadwork@gmail.com",
  //   to: "cjpogi@example.com",
  //   subject: "OTP For Login",
  //   text: `Your OTP is ${new_otp}. This is valid for 10 Minutes.`,
  // });

  res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
  });
};

exports.verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({
    email,
    // otp_expiry_time: { $gt: Date.now() },
  });


  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "Email is invalid or OTP has expired!",
    });
  }

  // Convert provided OTP to integer
  //const providedOTP = parseInt(otp);
  
  //console.log(typeof user.otp)
  //console.log(typeof otp)
  if(user.otp != otp)
  {
    return res.status(400).json({
      status: "error",
      message: "OTP is incorrect!",
    });
  }
  // Check if user exists and OTP is correct
  // if (user.otp !== otp) {
  //   return res.status(400).json({
  //     status: "error",
  //     message: "OTP is incorrect!",
  //   });
  // }

  // OTP is correct
  user.verified = true;
  user.otp = undefined;

  await user.save();

  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "Verified Successfully!",
    token,
  });
};

exports.login = async (req, res, next) => {
  // destructure the input data
  const { email, password } = req.body;

  // check if the data is null
  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
  }

  // check if the user exists
  const userDoc = await User.findOne({ email: email }).select("+password");

  // if the user does not exist or password is incorrect, send error response
  if (!userDoc || !(await userDoc.correctPassword(password, userDoc.password))) {
    return res.status(400).json({
      status: "error",
      message: "Email or password is incorrect!",
    });
  }

  // make token for the user
  const token = signToken(userDoc._id);

  // send success response with token
  res.status(200).json({
    status: "success",
    message: "Logged in Successfully!",
    token,
  });
};

exports.protect = async (req, res, next) => {
  //Getting the token if its existing in the Headers
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else {
    req.status(400).json({
      status: "error",
      message: "You are not logged in! Please log in to get access",
    });
    return;
  }

  // Verify the token
  const decoded = await promisify(jwt.verify)(
    token,
    process.env.CJ_POGI_SECRET_KEY
  );
  //Check if the user still exists
  const this_user = await User.findById(decoded.userId);

  if (!this_user) {
    res.status(400).json({
      status: "error",
      message: "The user doesnt exisits",
    });
  }

  //Check if user change their password after token was issued
  if (this_user.changedPasswordAfter(decoded.iat)) {
    res.status(400).json({
      status: "error",
      message: "User recently updated password! Please log in again",
    });
  }

  req.user = this_user;
  next();
};

exports.forgotPassword = async (req, res, next) => {
  // Get User Email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "There is no user with given email address",
    });
   
  }

  // Generate the random reset token for the url/Params
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `https://cjpogi.com/auth/reset-password/?code=${resetToken}`;

  console.log(resetToken);

  try {
    // TODO => Send Email With Reset URL

    res.status(200).json({
      status: "success",
      message: "Reset Password link sent to Email",
      resetToken: resetToken,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      status: "error",
      message: "There was an error sending the email, please try again later.",
    });
  }
};

exports.resetPassword = async (req, res, next) => {
 
  // Get user based on token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.token)
    .digest("hex");


  const user = await User.findOne({
    passwordResetToken: hashedToken,
  });

  // if token has expired or user is out of time window

  if (!user) {
    res.status(400).json({
      status: "error",
      message: "Token is invalid or Expired.",
    });

    return;
  }

  // Update user password and set reset token and expiry to undefined
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // TODO => send an email to user informing about password reset

  //Log in the user and send new jwt
  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "Password Reset Successfully!",
    token,
  });
};
