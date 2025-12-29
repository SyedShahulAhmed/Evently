import Notification from "../models/notification.model.js";
import APIResponse from "../utils/APIResponse.js";
import APIError from "../utils/APIError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { HTTP } from "../constants/httpStatus.js";

/* ============================================================================
   ROLE-BASED FETCHING
============================================================================ */

// USER NOTIFICATIONS
export const getUserNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    userId: req.user._id,
  }).sort({ createdAt: -1 });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, notifications, "User notifications fetched")
    );
});

// ORGANIZER NOTIFICATIONS
export const getOrganizerNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    organizerId: req.organizer._id,
  }).sort({ createdAt: -1 });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, notifications, "Organizer notifications fetched")
    );
});

// ADMIN NOTIFICATIONS
export const getAdminNotifications = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

  const notifications = await Notification.find({ adminId }).sort({
    createdAt: -1,
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, notifications, "Admin notifications fetched")
    );
});
/* MARK ONE READ */
export const adminMarkRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notif) throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, notif, "Notification marked read"));
});

/* MARK ALL READ */
export const adminMarkAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ adminId: req.user._id }, { read: true });
  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "All notifications marked read"));
});

/* DELETE ONE */
export const adminDeleteNotification = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndDelete({
    _id: req.params.id,
    adminId: req.user._id,
  });

  if (!notif) throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Notification deleted"));
});

/* DELETE ALL */
export const adminDeleteAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ adminId: req.user._id });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "All notifications deleted"));
});
/* ============================================================================
   MARK ONE READ
============================================================================ */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification)
    throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, notification, "Notification marked as read")
    );
});

/* ============================================================================
   MARK ALL READ
============================================================================ */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id }, { read: true });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "All notifications marked as read"));
});

/* ============================================================================
   DELETE ONE
============================================================================ */
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Notification.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });

  if (!deleted) throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Notification deleted"));
});

/* ============================================================================
   DELETE ALL
============================================================================ */
export const deleteAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "All notifications deleted"));
});

/* ===========================
   MARK ONE AS READ (ORGANIZER)
=========================== */
export const organizerMarkRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notif = await Notification.findOne({
    _id: id,
    organizerId: req.organizerId,
  });

  if (!notif) throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  notif.read = true;
  await notif.save();

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, notif, "Notification marked as read"));
});

/* ===========================
   MARK ALL AS READ (ORGANIZER)
=========================== */
export const organizerMarkAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { organizerId: req.organizerId },
    { $set: { read: true } }
  );

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "All notifications marked as read"));
});

/* ===========================
   DELETE ONE (ORGANIZER)
=========================== */
export const organizerDeleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notif = await Notification.findOneAndDelete({
    _id: id,
    organizerId: req.organizerId,
  });

  if (!notif) throw new APIError(HTTP.NOT_FOUND, "Notification not found");

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Notification deleted"));
});

/* ===========================
   DELETE ALL (ORGANIZER)
=========================== */
export const organizerDeleteAllNotifications = asyncHandler(
  async (req, res) => {
    await Notification.deleteMany({
      organizerId: req.organizerId,
    });

    return res
      .status(HTTP.OK)
      .json(new APIResponse(HTTP.OK, {}, "All notifications deleted"));
  }
);
