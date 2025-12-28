import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import Organizer from "../models/organizer.model.js";
import { HTTP } from "../constants/httpStatus.js";
import {
  sendAdminNotification,
  sendOrganizerApprovalEmail,
  sendOrganizerRejectionEmail,
} from "../services/notification.service.js";
import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import Notification from "../models/notification.model.js";
import { sendEmail } from "../utils/sendEmail.js";

export const getAllOrganizers = asyncHandler(async (req, res) => {
  const organizers = await Organizer.find().sort({ createdAt: -1 });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, organizers, "Organizers fetched successfully")
    );
});

export const getPendingOrganizers = asyncHandler(async (req, res) => {
  const organizers = await Organizer.find({ status: "pending" }).sort({
    createdAt: -1,
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        organizers,
        "Pending organizers fetched successfully"
      )
    );
});

export const getOrganizerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organizer = await Organizer.findById(id);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, organizer, "Organizer details fetched"));
});

/* ============================================================================
    APPROVE ORGANIZER
============================================================================ */
export const approveOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organizer = await Organizer.findById(id);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  if (organizer.status === "approved") {
    throw new APIError(HTTP.CONFLICT, "Organizer is already approved");
  }

  organizer.status = "approved";
  organizer.adminNotes = "";
  organizer.isEmailVerified = true;

  await organizer.save();

  // Send approval email to the organizer directly
  await sendOrganizerApprovalEmail(organizer.businessEmail);

  // Notify admin who approved
  await sendAdminNotification({
    adminId: req.user._id,
    title: "Organizer Approved",
    message: `You approved organizer '${organizer.businessName}'.`,
    type: "success",
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, organizer, "Organizer approved successfully")
    );
});


/* ============================================================================
    REJECT ORGANIZER
============================================================================ */
export const rejectOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  if (!adminNotes || adminNotes.trim() === "") {
    throw new APIError(HTTP.BAD_REQUEST, "Rejection reason is required");
  }

  // fetch organizer WITHOUT populate (populate is failing likely because
  // the schema doesn't contain ownerUserId)
  const organizer = await Organizer.findById(id);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  organizer.status = "rejected";
  organizer.adminNotes = adminNotes;
  await organizer.save();

  // --- Attempt to resolve owner user email safely ---
  // Common owner field names to check (customize if your schema uses a different name)
  const possibleOwnerFields = ["ownerUserId", "ownerId", "userId", "createdBy"];
  let ownerId = null;

  for (const f of possibleOwnerFields) {
    if (organizer[f]) {
      ownerId = organizer[f];
      break;
    }
  }

  let ownerUser = null;
  if (ownerId) {
    try {
      ownerUser = await User.findById(ownerId).select("email fullname");
    } catch (err) {
      // ignore - we'll proceed without ownerUser
      ownerUser = null;
    }
  }

  // Send emails / notifications only if we have the owner's email / id
  if (ownerUser && ownerUser.email) {
    // Email
    try {
      await sendOrganizerRejectionEmail(ownerUser.email, {
        businessName: organizer.businessName,
        reason: adminNotes,
      });
    } catch (err) {
      // log error (do not throw) - email failure shouldn't block response
      console.error("Failed to send rejection email:", err);
    }

    // In-app notification (if you have in-app notifications & userId)
    try {
      await sendInAppNotification({
        userId: ownerUser._id,
        title: "Organizer Application Rejected",
        message: `Your organizer application was rejected. Reason: ${adminNotes}`,
        type: "error",
      });
    } catch (err) {
      console.error("Failed to send in-app notification:", err);
    }
  } else {
    // optional: log that organizer had no linked owner user
    console.warn(
      `Organizer ${organizer._id} rejected but no owner user found to notify.`
    );
  }

  // Notify admin who performed the action
  try {
    await sendAdminNotification({
      adminId: req.user._id,
      title: "Organizer Rejected",
      message: `You rejected organizer '${organizer.businessName}'. Reason: ${adminNotes}`,
      type: "error",
    });
  } catch (err) {
    console.error("Failed to send admin notification:", err);
  }

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, organizer, "Organizer rejected successfully")
    );
});

/* ============================================================================
    BLOCK ORGANIZER
============================================================================ */
export const blockOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organizer = await Organizer.findById(id);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  if (organizer.status === "blocked") {
    throw new APIError(HTTP.CONFLICT, "Organizer is already blocked");
  }

  organizer.status = "blocked";
  await organizer.save();
  await sendAdminNotification({
    adminId: req.user._id,
    title: "Organizer Blocked",
    message: `Organizer '${organizer.businessName}' was blocked.`,
    type: "warning",
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, organizer, "Organizer blocked successfully")
    );
});

/* ============================================================================
    UNBLOCK ORGANIZER
============================================================================ */
export const unblockOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organizer = await Organizer.findById(id);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  if (organizer.status !== "blocked") {
    throw new APIError(HTTP.CONFLICT, "Organizer is not blocked");
  }

  organizer.status = "approved";
  await organizer.save();
  await sendAdminNotification({
    adminId: req.user._id,
    title: "Organizer Unblocked",
    message: `Organizer '${organizer.businessName}' was unblocked.`,
    type: "success",
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, organizer, "Organizer unblocked successfully")
    );
});

export const getOrganizerDeleteRequests = asyncHandler(async (req, res) => {
  const organizers = await Organizer.find({ deleteRequested: true }).sort({
    deleteRequestedAt: -1,
  });
  await sendAdminNotification({
    adminId: User._id,
    title: "Organizer Delete Request",
    message: `${organizers.businessName} has requested account deletion.`,
    type: "warning",
  });

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, organizers, "Delete requests fetched"));
});

export const deleteOrganizerPermanently = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organizer = await Organizer.findById(id);
  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  // 1️⃣ Delete organizer logo
  if (organizer.logo?.publicId) {
    await deleteFromCloudinary(organizer.logo.publicId);
  }

  // 2️⃣ Delete organizer documents
  if (organizer.documents?.length > 0) {
    for (const doc of organizer.documents) {
      if (doc.publicId) await deleteFromCloudinary(doc.publicId);
    }
  }

  // 3️⃣ Get all events by organizer
  const events = await Event.find({ createdBy: id });

  for (const event of events) {
    // 4️⃣ Delete event banner
    if (event.banner?.publicId) {
      await deleteFromCloudinary(event.banner.publicId);
    }

    // 5️⃣ Delete gallery images
    if (event.gallery?.length > 0) {
      for (const img of event.gallery) {
        if (img.publicId) await deleteFromCloudinary(img.publicId);
      }
    }

    // 6️⃣ Delete registrations for the event
    await Registration.deleteMany({ eventId: event._id });

    // 7️⃣ Delete bookmarks for the event
    await Bookmark.deleteMany({ eventId: event._id });
  }

  // 8️⃣ Delete notifications for organizer
  await Notification.deleteMany({ userId: id });

  // 9️⃣ Delete events
  await Event.deleteMany({ createdBy: id });

  // 🔟 Finally delete organizer
  await Organizer.findByIdAndDelete(id);

  // 📩 Email confirmation to organizer
  await sendEmail({
    to: organizer.businessEmail,
    subject: "Your Organizer Account Has Been Deleted",
    html: `<p>Your organizer account <strong>${organizer.businessName}</strong> has been permanently deleted by the admin.</p>`,
  });
  await sendAdminNotification({
    adminId: req.user._id,
    title: "Organizer Deleted Permanently",
    message: `Organizer '${organizer.businessName}' and all their data were deleted.`,
    type: "error",
  });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        null,
        "Organizer and all related data deleted permanently"
      )
    );
});
