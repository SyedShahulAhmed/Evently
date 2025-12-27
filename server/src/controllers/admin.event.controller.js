import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import { HTTP } from "../constants/httpStatus.js";

import Event from "../models/event.model.js";
import Organizer from "../models/organizer.model.js";
import Registration from "../models/registration.model.js";
import Notification from "../models/notification.model.js";
import { deleteMediaArray } from "../utils/cloudinary.js";

import { createAuditLog } from "../services/audit.service.js";

/* ------------------- DELETE ANY EVENT (admin) -------------------- */
export const adminDeleteEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const adminId = req.user._id;

  const event = await Event.findById(eventId).populate("createdBy", "businessName ownerUserId");
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  // delete media
  await deleteMediaArray([event.banner, ...(event.gallery || [])].filter(Boolean));

  // notify organizer
  if (event.createdBy) {
    await Notification.create({
      organizerId: event.createdBy,
      title: "Event Removed by Admin",
      message: `Your event '${event.title}' was removed by admin.`,
      type: "warning",
    }).catch(()=>{});
  }

  // notify registered users
  const regs = await Registration.find({ eventId: event._id }).populate("userId", "email");
  for (const r of regs) {
    try {
      await Notification.create({
        userId: r.userId._id,
        title: "Event Cancelled",
        message: `Event '${event.title}' was cancelled by admin.`,
        type: "error"
      });
    } catch(e){}
  }

  // cleanup registrations
  await Registration.deleteMany({ eventId: event._id });

  // delete event
  await event.deleteOne();

  // audit
  await createAuditLog({
    adminId,
    action: "event_deleted",
    module: "events",
    metadata: { eventId, title: event.title },
    organizerId: event.createdBy ? event.createdBy._id : null,
    eventId
  });

  return res.status(HTTP.OK).json(new APIResponse(HTTP.OK, {}, "Event deleted by admin"));
});

/* ------------------- FEATURE / UNFEATURE -------------------- */
export const adminFeatureEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const adminId = req.user._id;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  event.isFeatured = true;   // FIXED
  await event.save();

  await createAuditLog({
    adminId,
    action: "event_featured",
    module: "events",
    metadata: { eventId, title: event.title }
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, event, "Event featured"));
});


export const adminUnfeatureEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const adminId = req.user._id;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  event.isFeatured = false;   // FIXED
  await event.save();

  await createAuditLog({
    adminId,
    action: "event_unfeatured",
    module: "events",
    metadata: { eventId, title: event.title }
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, event, "Event unfeatured"));
});


/* ------------------- REMOVE INAPPROPRIATE EVENT (alias delete with note) -------------------- */
export const adminRemoveInappropriateEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  /* ---------------------------------------------
     1. DELETE ALL MEDIA
  --------------------------------------------- */
  await deleteMediaArray(
    [event.banner, ...(event.gallery || [])].filter(Boolean)
  );

  /* ---------------------------------------------
     2. DELETE ALL REGISTRATIONS FOR THIS EVENT
  --------------------------------------------- */
  await Registration.deleteMany({ eventId });

  /* ---------------------------------------------
     3. SEND IN-APP NOTIFICATION TO ORGANIZER
  --------------------------------------------- */
  await Notification.create({
    organizerId: event.createdBy,
    title: "Event Removed for Policy Violation",
    message: `Your event '${event.title}' was removed by admin. Reason: ${
      reason || "Not specified"
    }`,
    type: "error",
  }).catch(() => {});

  /* ---------------------------------------------
     4. DELETE EVENT DOCUMENT
  --------------------------------------------- */
  await event.deleteOne();

  /* ---------------------------------------------
     5. AUDIT LOG FOR HISTORY
  --------------------------------------------- */
  await createAuditLog({
    adminId,
    organizerId: event.createdBy,
    eventId,
    action: "event_removed_inappropriate",
    module: "events",
    metadata: { reason, title: event.title },
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        {},
        "Event removed for policy violation"
      )
    );
});

/* ------------------- BAN ORGANIZER TEMPORARILY -------------------- */
/**
 * body: { days: number } -> number of days to ban (optional)
 */
export const adminBanOrganizer = asyncHandler(async (req, res) => {
  const { organizerId } = req.params;
  const { days = 7, reason = "Not provided" } = req.body;

  const organizer = await Organizer.findById(organizerId);
  if (!organizer) throw new APIError(HTTP.NOT_FOUND, "Organizer not found");

  const bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  organizer.ban = {
    isBanned: true,
    bannedUntil,
    reason
  };

  await organizer.save();

  return res.status(200).json(
    new APIResponse(
      200,
      { organizer },
      `Organizer banned for ${days} day(s)`
    )
  );
});



/* ------------------- UNBAN / UNBLOCK ORGANIZER -------------------- */
export const adminUnbanOrganizer = asyncHandler(async (req, res) => {
  const { organizerId } = req.params;
  const adminId = req.user._id;

  const organizer = await Organizer.findById(organizerId);
  if (!organizer) throw new APIError(HTTP.NOT_FOUND, "Organizer not found");

  organizer.ban = {
    isBanned: false,
    bannedUntil: null,
    reason: ""
  };

  organizer.status = "approved";
  await organizer.save();

  await Notification.create({
    organizerId,
    title: "Ban Removed",
    message: "Your organizer account ban has been lifted.",
    type: "success"
  }).catch(() => {});

  await createAuditLog({
    adminId,
    action: "organizer_unbanned",
    module: "organizers",
    metadata: { organizerId },
    organizerId
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, organizer, "Organizer unbanned"));
});

