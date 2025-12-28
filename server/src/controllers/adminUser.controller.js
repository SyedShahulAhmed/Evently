import asyncHandler from "../utils/asyncHandler.js";
import APIResponse from "../utils/APIResponse.js";
import User from "../models/user.model.js";
import { HTTP } from "../constants/httpStatus.js";

// import Registration from "../models/registration.model.js";
// import Bookmark from "../models/bookmark.model.js";
// import Notification from "../models/notification.model.js";
// import { deleteFromCloudinaryz } from "../utils/cloudinaryUploader.js";
export const getAllUsers = asyncHandler(async (req, res) => {
  const { search, role, status } = req.query;

  let filter = {};

  // 🔍 Search filter
  if (search) {
    filter.$or = [
      { username: new RegExp(search, "i") },
      { fullname: new RegExp(search, "i") },
      { email: new RegExp(search, "i") },
    ];
  }

  // 🎭 Role filter
  if (role) filter.role = role;

  // 🚫 Blocked / unblocked
  if (status === "blocked") filter.isBlocked = true;
  if (status === "active") filter.isBlocked = false;

  const users = await User.find(filter).sort({ createdAt: -1 });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, users, "Users fetched successfully"));
});

export const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  if (user.isBlocked)
    throw new APIError(HTTP.CONFLICT, "User already blocked");

  user.isBlocked = true;
  user.blockReason = req.body.reason || "No reason provided";

  await user.save();

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, null, "User blocked successfully"));
});

export const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  if (!user.isBlocked)
    throw new APIError(HTTP.CONFLICT, "User is not blocked");

  user.isBlocked = false;
  user.blockReason = "";
  await user.save();

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, null, "User unblocked successfully"));
});


export const deleteUserPermanently = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new APIError(HTTP.NOT_FOUND, "User not found");

  // Delete avatar
  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId);
  }

  // Delete registrations
  await Registration.deleteMany({ userId: id });

  // Delete bookmarks
  await Bookmark.deleteMany({ userId: id });

  // Delete notifications
  await Notification.deleteMany({ userId: id });

  // Delete user
  await User.findByIdAndDelete(id);

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, null, "User deleted permanently"));
});
