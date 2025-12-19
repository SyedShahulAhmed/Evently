import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import { HTTP } from "../constants/httpStatus.js";

import Event from "../models/event.model.js";
import Organizer from "../models/organizer.model.js";

import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  deleteMediaArray,
} from "../utils/cloudinary.js";

import {
  createEventSchema,
  duplicateEventSchema,
  updateEventSchema,
} from "../validators/event.schema.js";
import Registration from "../models/registration.model.js";
import { sendInAppNotification } from "../services/notification.service.js";

export const organizerGetMyEvents = asyncHandler(async (req, res) => {
  const organizer = req.organizer;

  if (!organizer) {
    throw new APIError(HTTP.FORBIDDEN, "Organizer authentication required");
  }

  const events = await Event.find({ createdBy: organizer._id }).sort({
    createdAt: -1,
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, { events }, "Organizer events fetched"));
});

export const createEvent = asyncHandler(async (req, res) => {
  // -----------------------------
  // 1. ZOD VALIDATION
  // -----------------------------
  const parsed = createEventSchema.safeParse({ body: req.body });

  if (!parsed.success) {
    throw new APIError(
      HTTP.BAD_REQUEST,
      "Validation failed",
      parsed.error.errors
    );
  }

  const data = parsed.data.body;

  // -----------------------------
  // 2. ORGANIZER AUTH (from organizerAuth middleware)
  // -----------------------------
  const organizer = req.organizer;

  if (!organizer) {
    throw new APIError(HTTP.FORBIDDEN, "Organizer authentication required");
  }

  if (organizer.status !== "approved") {
    throw new APIError(HTTP.FORBIDDEN, "Organizer is not approved");
  }

  const organizerId = organizer._id;

  // -----------------------------
  // 3. DATE VALIDATION
  // -----------------------------
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (endDate <= startDate) {
    throw new APIError(HTTP.BAD_REQUEST, "endDate must be after startDate");
  }

  // -----------------------------
  // 4. FILES (banner required)
  // -----------------------------
  const bannerFile = req.files?.banner?.[0];

  if (!bannerFile) {
    throw new APIError(HTTP.BAD_REQUEST, "Banner image is required");
  }

  const galleryFiles = req.files?.gallery || [];

  if (galleryFiles.length > 10) {
    throw new APIError(HTTP.BAD_REQUEST, "Gallery max 10 images allowed");
  }

  // -----------------------------
  // 5. UPLOAD BANNER
  // -----------------------------
  let bannerUpload;
  try {
    bannerUpload = await uploadBufferToCloudinary(
      bannerFile.buffer,
      `evently/events/${organizerId}/banner`
    );
  } catch (err) {
    throw new APIError(HTTP.INTERNAL_ERROR, "Banner upload failed", [
      { message: err.message },
    ]);
  }

  // -----------------------------
  // 6. UPLOAD GALLERY
  // -----------------------------
  const gallery = [];

  for (const file of galleryFiles) {
    try {
      const uploadRes = await uploadBufferToCloudinary(file.buffer, {
        folder: `evently/events/${organizerId}/gallery`,
      });
      gallery.push(uploadRes);
    } catch (err) {
      // Clean up on failure
      await deleteFromCloudinary(bannerUpload.publicId).catch(() => {});
      for (const uploaded of gallery) {
        await deleteFromCloudinary(uploaded.publicId).catch(() => {});
      }

      throw new APIError(HTTP.INTERNAL_ERROR, "Gallery upload failed", [
        { message: err.message },
      ]);
    }
  }

  // -----------------------------
  // 7. BUILD EVENT OBJECT
  // -----------------------------
  const eventDoc = {
    title: data.title,
    shortDescription: data.shortDescription,
    description: data.description,

    category: data.category,
    tags: data.tags,

    locationType: data.locationType,
    locationAddress: data.locationAddress,
    eventURL: data.eventURL,

    startDate,
    endDate,

    banner: bannerUpload,
    gallery,

    createdBy: organizerId,
    status: data.status || "draft",
    ticketLimit: data.ticketLimit || 0,

    totalViews: 0,
    totalRegistrations: 0,
  };

  // -----------------------------
  // 8. SAVE EVENT
  // -----------------------------
  const createdEvent = await Event.create(eventDoc);

  // -----------------------------
  // 9. UPDATE ORGANIZER STATS
  // -----------------------------
  organizer.totalEventsCreated = (organizer.totalEventsCreated || 0) + 1;

  await organizer.save({ validateBeforeSave: false });

  await sendInAppNotification({
    organizerId: organizerId,
    title: "Event Created",
    message: `Your event '${createdEvent.title}' has been created successfully.`,
    type: "success",
  });

  // -----------------------------
  // 10. RESPONSE
  // -----------------------------
  return res
    .status(HTTP.CREATED)
    .json(
      new APIResponse(HTTP.CREATED, { event: createdEvent }, "Event created")
    );
});

/**
 * UPDATE EVENT (organizer-only, ownership check, 24-hr lock)
 * Accepts multipart/form-data if replacing banner/gallery.
 */
export const updateEvent = asyncHandler(async (req, res) => {
  // Validate body fields (Zod handles form-data conversions)
  const parsed = updateEventSchema.safeParse({ body: req.body });
  if (!parsed.success) {
    throw new APIError(
      HTTP.BAD_REQUEST,
      "Validation failed",
      parsed.error.errors
    );
  }
  const data = parsed.data.body;

  const organizer = req.organizer;
  if (!organizer)
    throw new APIError(HTTP.FORBIDDEN, "Organizer authentication required");

  // Find event
  const eventId = req.params.eventId;
  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  // Ownership
  if (event.createdBy.toString() !== organizer._id.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "Not authorized to edit this event");
  }

  // 24-hour lock
  const now = new Date();
  const diffMs = new Date(event.startDate) - now;
  if (diffMs < 1000 * 60 * 60 * 24) {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Event cannot be modified within 24 hours of start time"
    );
  }

  // Date validation if both provided
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate) data.endDate = new Date(data.endDate);
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    throw new APIError(HTTP.BAD_REQUEST, "endDate must be after startDate");
  }

  // Update scalar fields
  const updatableFields = [
    "title",
    "shortDescription",
    "description",
    "category",
    "tags",
    "locationType",
    "locationAddress",
    "eventURL",
    "startDate",
    "endDate",
    "ticketLimit",
    "status",
  ];
  for (const f of updatableFields) {
    if (data[f] !== undefined) event[f] = data[f];
  }

  // Gallery handling
  const replaceGallery = data.replaceGallery === true;
  const galleryFiles = req.files?.gallery ?? [];
  if (replaceGallery) {
    // delete all existing gallery images from Cloudinary
    await deleteMediaArray(event.gallery);
    event.gallery = [];
  }

  // If removeGalleryPublicIds provided (CSV), remove those publicIds from event.gallery
  if (data.removeGalleryPublicIds) {
    const removeList = data.removeGalleryPublicIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (removeList.length) {
      // filter and delete
      const toKeep = [];
      const toDelete = [];
      for (const g of event.gallery) {
        if (removeList.includes(g.publicId)) toDelete.push(g);
        else toKeep.push(g);
      }
      event.gallery = toKeep;
      await deleteMediaArray(toDelete);
    }
  }

  // Append new gallery files (if any) - ensure not exceed 10
  if (galleryFiles.length > 0) {
    // check current count
    if ((event.gallery?.length || 0) + galleryFiles.length > 10) {
      throw new APIError(HTTP.BAD_REQUEST, "Gallery max 10 images allowed");
    }
    for (const file of galleryFiles) {
      const uploaded = await uploadBufferToCloudinary(
        file.buffer,
        `evently/events/${organizer._id}/gallery`
      );
      event.gallery.push({ url: uploaded.url, publicId: uploaded.publicId });
    }
  }

  // Banner replace
  const bannerFile = req.files?.banner?.[0];
  if (bannerFile) {
    // delete old banner from Cloudinary
    if (event.banner?.publicId) {
      try {
        await deleteMediaArray([event.banner]);
      } catch (e) {
        /* warn only */
      }
    }
    const uploaded = await uploadBufferToCloudinary(
      bannerFile.buffer,
      `evently/events/${organizer._id}/banner`
    );
    event.banner = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await event.save();

  await sendInAppNotification({
    organizerId: organizer._id,
    title: "Event Updated",
    message: `Your event '${event.title}' has been updated.`,
    type: "info",
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, { event }, "Event updated"));
});

/**
 * DELETE EVENT (organizer-only, ownership check, 24-hr lock)
 */
export const deleteEvent = asyncHandler(async (req, res) => {
  const organizer = req.organizer;
  if (!organizer)
    throw new APIError(HTTP.FORBIDDEN, "Organizer authentication required");

  const eventId = req.params.eventId;
  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  if (event.createdBy.toString() !== organizer._id.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "Not authorized to delete this event");
  }

  // Notify all registered users before deleting
const registrations = await Registration.find({ eventId: event._id });

for (const reg of registrations) {
  await sendInAppNotification({
    userId: reg.userId,
    title: "Event Cancelled",
    message: `The event '${event.title}' has been cancelled.`,
    type: "warning"
  });
}

  // 24-hour lock
  const now = new Date();
  if (new Date(event.startDate) - now < 1000 * 60 * 60 * 24) {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Event cannot be deleted within 24 hours of start time"
    );
  }

  // Delete media
  await deleteMediaArray(
    [event.banner, ...(event.gallery || [])].filter(Boolean)
  );

  // Optional: delete registrations linked to event (implement if you have registration model)
  // await Registration.deleteMany({ eventId: event._id });

  // remove event
  await event.deleteOne();

  // decrement organizer.totalEventsCreated (best-effort)
  try {
    organizer.totalEventsCreated = Math.max(
      0,
      (organizer.totalEventsCreated || 1) - 1
    );
    await organizer.save({ validateBeforeSave: false });
  } catch (err) {
    console.warn(
      "Failed to decrement organizer.totalEventsCreated",
      err?.message
    );
  }

  await sendInAppNotification({
    organizerId: organizer._id,
    title: "Event Deleted",
    message: `Your event '${event.title}' has been deleted.`,
    type: "warning",
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Event deleted"));
});

/**
 * DUPLICATE EVENT (organizer-only). Duplicate uses same media references (no reupload).
 * Status reset to draft, title appended with "(Copy)".
 */
export const duplicateEvent = asyncHandler(async (req, res) => {
  const parsed = duplicateEventSchema.safeParse({
    params: req.params,
    body: req.body || {},
  });
  if (!parsed.success)
    throw new APIError(
      HTTP.BAD_REQUEST,
      "Validation failed",
      parsed.error.errors
    );

  const organizer = req.organizer;
  if (!organizer)
    throw new APIError(HTTP.FORBIDDEN, "Organizer authentication required");

  const eventId = req.params.eventId;
  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  if (event.createdBy.toString() !== organizer._id.toString()) {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Not authorized to duplicate this event"
    );
  }

  // clone fields
  const clone = {
    title: `${event.title} (Copy)`,
    shortDescription: event.shortDescription,
    description: event.description,
    category: event.category,
    tags: event.tags,
    locationType: event.locationType,
    locationAddress: event.locationAddress,
    eventURL: event.eventURL,
    startDate: parsed.data?.body?.startDate
      ? new Date(parsed.data.body.startDate)
      : event.startDate,
    endDate: parsed.data?.body?.endDate
      ? new Date(parsed.data.body.endDate)
      : event.endDate,
    banner: event.banner, // reuse same url/publicId
    gallery: event.gallery || [],
    createdBy: organizer._id,
    status: "draft",
    ticketLimit: event.ticketLimit || 0,
    totalViews: 0,
    totalRegistrations: 0,
  };

  const newEvent = await Event.create(clone);

  // increment organizer.count
  organizer.totalEventsCreated = (organizer.totalEventsCreated || 0) + 1;
  await organizer.save({ validateBeforeSave: false });

  await sendInAppNotification({
    organizerId: organizer._id,
    title: "Event Duplicated",
    message: `Your event '${event.title}' has been duplicated.`,
    type: "success",
  });

  return res
    .status(HTTP.CREATED)
    .json(
      new APIResponse(HTTP.CREATED, { event: newEvent }, "Event duplicated")
    );
});

export const publishEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findOne({
    _id: eventId,
    createdBy: req.organizerId,
  });

  if (!event) throw new APIError(404, "Event not found");

  // Cannot publish past events
  if (new Date(event.startDate) < new Date()) {
    throw new APIError(400, "You cannot publish an event that already started");
  }

  event.status = "published";
  await event.save();
  await sendInAppNotification({
    organizerId: req.organizerId,
    title: "Event Published",
    message: `Your event '${event.title}' is now live.`,
    type: "success",
  });

  return res
    .status(200)
    .json(new APIResponse(200, { event }, "Event published"));
});

export const unpublishEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findOne({
    _id: eventId,
    createdBy: req.organizerId,
  });

  if (!event) throw new APIError(404, "Event not found");

  event.status = "draft";
  await event.save();
  await sendInAppNotification({
    organizerId: req.organizerId,
    title: "Event Unpublished",
    message: `Your event '${event.title}' has been moved to draft.`,
    type: "info",
  });

  return res
    .status(200)
    .json(new APIResponse(200, { event }, "Event moved back to draft"));
});
