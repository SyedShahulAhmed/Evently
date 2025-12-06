import { HTTP } from "../constants/httpStatus.js";
import User from "../models/user.model.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadBufferToCloudinary } from "../utils/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

/* ---------------------- FETCH PROFILE ---------------------- */
export const getMyProfile = asyncHandler(async (req, res) => {
  const user = req.user;

  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      {
        _id: user._id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
      "Profile fetched"
    )
  );
});

/* ---------------------- UPDATE PROFILE ---------------------- */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { fullname, username } = req.body;
  const user = req.user;

  if (username) {
    const exists = await User.findOne({ username, _id: { $ne: user._id } });
    if (exists)
      throw new APIError(HTTP.CONFLICT, "Username already taken");
  }

  if (fullname) user.fullname = fullname;
  if (username) user.username = username.toLowerCase();

  await user.save();

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Profile updated"));
});

/* ---------------------- UPDATE PASSWORD ---------------------- */
export const updateMyPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch)
    throw new APIError(HTTP.UNAUTHORIZED, "Old password is incorrect");

  user.password = newPassword;

  // Invalidate refresh token
  user.refreshToken = null;

  await user.save();

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        {},
        "Password updated successfully. Please log in again."
      )
    );
});

/* ---------------------- UPDATE AVATAR ---------------------- */

export const updateMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new APIError(HTTP.BAD_REQUEST, "Avatar file is required");
  }

  // MUST INCLUDE password, otherwise save() won't work
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new APIError(HTTP.NOT_FOUND, "User not found");
  }

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId);
  }

  const result = await uploadBufferToCloudinary(
    req.file.buffer,
    "evently/avatars"
  );

  user.avatar = {
    url: result.url,
    publicId: result.publicId,
  };

  await user.save();

  return res.status(200).json(
    new APIResponse(
      200,
      { avatar: user.avatar },
      "Avatar updated successfully"
    )
  );
});

/* ---------------------- DELETE ACCOUNT ---------------------- */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    throw new APIError(HTTP.UNAUTHORIZED, "Incorrect password");

  // Delete avatar from Cloudinary if present
  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId);
  }

  // Delete user permanently
  await User.findByIdAndDelete(user._id);

  // 2️⃣ Send account delete confirmation email
  await sendEmail({
    to: user.email,
    subject: "Your Evently Account Has Been Deleted",
    intro: "Your account has been permanently removed from Evently.",
    instruction: null,
    outro: "If you did not request this, contact support immediately."
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Account deleted successfully"));
});

