import User from "../models/user.model.js";
import crypto from "crypto";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwtProvider.js";
import { HTTP } from "../constants/httpStatus.js";
import { sendEmail } from "../utils/sendEmail.js";
import cloudinary from "cloudinary";
import bcrypt from "bcrypt"

/* ---------------------- REGISTER USER ---------------------- */
export const registerUser = asyncHandler(async (req, res) => {
  const { username, fullname, email, password } = req.body;

  // Check email exists
  const userExists = await User.findOne({ email });
  if (userExists) throw new APIError(HTTP.CONFLICT, "Email already registered");

  // Check username exists
  const usernameExists = await User.findOne({ username });
  if (usernameExists)
    throw new APIError(HTTP.CONFLICT, "Username already taken");

  // Generate email verification token
  const emailToken = crypto.randomBytes(32).toString("hex");
  const emailExpiry = Date.now() + 15 * 60 * 1000; // 15 mins

  const newUser = await User.create({
    username,
    fullname,
    email,
    password,
    emailVerificationToken: emailToken,
    emailVerificationExpiry: emailExpiry,
  });

  /** ✉ SEND VERIFICATION EMAIL */
  await sendEmail({
    to: newUser.email,
    subject: "Verify your Evently account",
    intro: `Hi ${newUser.fullname}, verify your email to activate your Evently account.`,
    instruction: {
      text: "Click the button below to verify your email:",
      buttonText: "Verify Email",
      buttonLink: `${process.env.CLIENT_URL}/verify-email/${emailToken}`,
    },
    outro: "This link expires in 15 minutes.",
  });

  return res.status(HTTP.CREATED).json(
    new APIResponse(
      HTTP.CREATED,
      {
        email: newUser.email,
        message: "Verification email sent. Please check your inbox.",
      },
      "Registration successful"
    )
  );
});

/* ---------------------- LOGIN USER ---------------------- */

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    throw new APIError(HTTP.BAD_REQUEST, "Email & Password required");

  // 1️⃣ Find user with password
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  // 2️⃣ Check if account is blocked by admin
  if (user.isBlocked) {
    const reason = user.blockReason || "No reason provided";
    throw new APIError(
      HTTP.FORBIDDEN,
      `Your account has been blocked by admin. Reason: ${reason}`
    );
  }

  // 3️⃣ Check if account is currently locked (too many wrong attempts)
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const remainingMs = user.lockUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

    throw new APIError(
      HTTP.FORBIDDEN,
      `Too many failed attempts. Try again in ${remainingMinutes} minute(s).`
    );
  }

  // 4️⃣ Check email verification
  if (!user.isEmailVerified) {
    throw new APIError(
      HTTP.UNAUTHORIZED,
      "Please verify your email before logging in"
    );
  }

  // 5️⃣ Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    // Increment login attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    // If 5 or more attempts → lock account for 15 minutes
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      user.loginAttempts = 0; // reset counter after locking
    }

    await user.save({ validateBeforeSave: false });

    throw new APIError(HTTP.UNAUTHORIZED, "Invalid credentials");
  }

  // 6️⃣ Successful login → reset attempts & lock
  user.loginAttempts = 0;
  user.lockUntil = null;

  // 7️⃣ Generate tokens (using full user + req)
  const accessToken = generateAccessToken(user, req);
  const refreshToken = generateRefreshToken(user, req);

  // 8️⃣ Save refresh token in DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // 9️⃣ Send response
  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          username: user.username,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
        },
      },
      "Login successful"
    )
  );
});

/* ---------------------- VERIFY EMAIL ---------------------- */

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.params.token;

  // ✅ HASH incoming token
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() }, // not expired
  });

  if (!user) {
    throw new APIError(HTTP.BAD_REQUEST, "Invalid or expired token");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  await user.save({ validateBeforeSave: false });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Email verified successfully"));
});


export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  if (user.isEmailVerified)
    throw new APIError(HTTP.BAD_REQUEST, "Email already verified");

  const newToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = newToken;
  user.emailVerificationExpiry = Date.now() + 15 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  await sendEmail({
    to: user.email,
    subject: "Resend Email Verification - Evently",
    intro: "Verify your email to continue using Evently.",
    instruction: {
      text: "Click below to verify your email:",
      buttonText: "Verify Email",
      buttonLink: `${process.env.CLIENT_URL}/verify-email/${newToken}`,
    },
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Verification email resent"));
});

/* ---------------------- REFRESH TOKEN ---------------------- */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    throw new APIError(HTTP.BAD_REQUEST, "Refresh token is required");

  // 1️⃣ Verify refresh token signature
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new APIError(HTTP.UNAUTHORIZED, "Invalid refresh token");
  }

  // 2️⃣ Find user
  const user = await User.findById(decoded.id);
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User no longer exists");

  // 3️⃣ Check if stored refresh token matches (Rotation)
  if (!user.refreshToken || user.refreshToken !== refreshToken) {
    throw new APIError(HTTP.UNAUTHORIZED, "Session expired or invalid");
  }

  // 4️⃣ Check email verification
  if (!user.isEmailVerified) {
    throw new APIError(HTTP.UNAUTHORIZED, "Please verify your email first");
  }

  // 5️⃣ Generate new tokens
  const newAccessToken = generateAccessToken(user, req);
  const newRefreshToken = generateRefreshToken(user, req);

  // 6️⃣ Rotate refresh tokens in DB
  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  // 7️⃣ Return new tokens
  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    )
  );
});

/* ---------------------- LOGOUT USER ---------------------- */
export const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    throw new APIError(HTTP.BAD_REQUEST, "Refresh token is required");

  // Decode user
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    // even invalid tokens → treat as logged out
    return res
      .status(HTTP.OK)
      .json(new APIResponse(HTTP.OK, {}, "Logged out successfully"));
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return res
      .status(HTTP.OK)
      .json(new APIResponse(200, {}, "Logged out successfully"));
  }

  // Remove stored refresh token
  user.refreshToken = null;
  await user.save({ validateBeforeSave: false });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Logged out successfully"));
});

/* ---------------------- FORGOT PASSWORD ---------------------- */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user)
    throw new APIError(HTTP.NOT_FOUND, "No user found with this email");

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpiry = Date.now() + 20 * 60 * 1000; // 20 minutes

  user.forgotPasswordToken = resetToken;
  user.forgotPasswordExpiry = resetExpiry;

  await user.save({ validateBeforeSave: false });

  // Send email
  await sendEmail({
    to: user.email,
    subject: "Reset Your Evently Password",
    intro: `Hi ${user.fullname}, click the button below to reset your password.`,
    instruction: {
      text: "Reset your password using the link below:",
      buttonText: "Reset Password",
      buttonLink: `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
    },
    outro: "This link expires in 20 minutes.",
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, {}, "Reset link sent to your email address")
    );
});

/* ---------------------- RESET PASSWORD ---------------------- */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await User.findOne({
    forgotPasswordToken: token,
    forgotPasswordExpiry: { $gt: Date.now() },
  }).select("+password");

  if (!user) {
    throw new APIError(HTTP.BAD_REQUEST, "Invalid or expired token");
  }

  // 🔒 CHECK: New password cannot be same as old password
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new APIError(
      HTTP.BAD_REQUEST,
      "New password must be different from your old password"
    );
  }

  // ✔ Update password
  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  user.refreshToken = null;

  await user.save();

  // 📧 Confirmation email
  await sendEmail({
    to: user.email,
    subject: "Your Password Has Been Successfully Reset",
    intro: "Your Evently password was successfully updated.",
    outro: "If you didn't do this, secure your account immediately.",
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Password reset successful"));
});
