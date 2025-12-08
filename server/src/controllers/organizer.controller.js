// src/controllers/organizer.controller.js
import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import Organizer from "../models/organizer.model.js";
import { HTTP } from "../constants/httpStatus.js";
import Event from "../models/event.model.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtProvider.js";
import { sendAdminNotification } from "../services/notification.service.js";
import User from "../models/user.model.js";

/* ============================================================================
   1. REGISTER ORGANIZER (Completely separate account)
============================================================================ */
export const registerOrganizer = asyncHandler(async (req, res) => {
  const {
    businessName,
    businessEmail,
    password,
    phone,
    website,
    businessDescription,
    category,
    city,
    state,
    country,
    address,
  } = req.body;

  const normalizedEmail = businessEmail.toLowerCase();

  // Must use business email
  if (
    normalizedEmail.endsWith("@gmail.com") ||
    normalizedEmail.endsWith("@yahoo.com") ||
    normalizedEmail.endsWith("@hotmail.com")
  ) {
    throw new APIError(HTTP.BAD_REQUEST, "Business email required");
  }

  // Check if organizer already exists
  const exists = await Organizer.findOne({ businessEmail: normalizedEmail });
  if (exists)
    throw new APIError(HTTP.CONFLICT, "Organizer account already exists");

  const organizer = await Organizer.create({
    businessName,
    businessEmail: normalizedEmail,
    password,
    phone,
    website,
    businessDescription,
    category,
    city,
    state,
    country,
    address,
    status: "pending", // admin approval required
  });
  /* ------------------------------------------------------------------
   ADMIN NOTIFICATION: New organizer pending approval
------------------------------------------------------------------ */
  const admins = await User.find({ role: "admin" });

  for (const admin of admins) {
    await sendAdminNotification({
      adminId: admin._id,
      title: "New Organizer Application",
      message: `${businessName} has registered and is waiting for approval.`,
      type: "info",
    });
  }

  return res
    .status(HTTP.CREATED)
    .json(
      new APIResponse(
        HTTP.CREATED,
        { organizer },
        "Organizer registered successfully. Pending admin approval."
      )
    );
});

/* ============================================================================
   2. LOGIN ORGANIZER
============================================================================ */
export const loginOrganizer = asyncHandler(async (req, res) => {
  const { businessEmail, password } = req.body;

  // -----------------------------
  // 1. Find organizer
  // -----------------------------
  const organizer = await Organizer.findOne({
    businessEmail: businessEmail.toLowerCase(),
  }).select("+password");

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  // -----------------------------
  // 2. Account State Validation
  // -----------------------------

  // ❌ Rejected organizer
  if (organizer.status === "rejected") {
    throw new APIError(
      HTTP.FORBIDDEN,
      `Your account was rejected. Reason: ${
        organizer.adminNotes || "No reason provided"
      }`
    );
  }

  // ❌ Pending approval
  if (organizer.status === "pending") {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Organizer not approved yet. Contact admin."
    );
  }

  // ❌ Delete request under review
  if (organizer.deleteRequested) {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Your account deletion request is under review. Please wait."
    );
  }

  // -----------------------------
  // 3. Temporary Ban Check
  // -----------------------------
  if (organizer.ban?.isBanned) {
    const now = new Date();
    const bannedUntil = new Date(organizer.ban.bannedUntil);

    // Auto-Unban if ban expired
    if (organizer.ban.bannedUntil && now > bannedUntil) {
      organizer.ban.isBanned = false;
      organizer.ban.reason = "";
      organizer.ban.bannedUntil = null;
      await organizer.save();
    } else {
      const untilFormatted = bannedUntil.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      throw new APIError(
        HTTP.FORBIDDEN,
        `Your organizer account is temporarily banned until ${untilFormatted}. Reason: ${organizer.ban.reason}`
      );
    }
  }

  // -----------------------------
  // 4. Permanent Ban Check
  // -----------------------------
  if (organizer.status === "blocked") {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Your organizer account is permanently blocked. Contact admin."
    );
  }

  // -----------------------------
  // 5. Final Status Check
  // -----------------------------
  if (organizer.status !== "approved") {
    throw new APIError(
      HTTP.FORBIDDEN,
      "Organizer account inactive or invalid status"
    );
  }

  // -----------------------------
  // 6. Password Check
  // -----------------------------
  const isMatch = await organizer.comparePassword(password);
  if (!isMatch) {
    throw new APIError(HTTP.UNAUTHORIZED, "Invalid credentials");
  }

  // -----------------------------
  // 7. Generate Tokens
  // -----------------------------
  const accessToken = generateAccessToken(organizer, req);
  const refreshToken = generateRefreshToken(organizer, req);

  organizer.refreshToken = refreshToken;
  await organizer.save({ validateBeforeSave: false });

  // -----------------------------
  // 8. Success Response
  // -----------------------------
  return res.status(HTTP.OK).json(
    new APIResponse(HTTP.OK, {
      organizer,
      accessToken,
      refreshToken,
    })
  );
});

/* ============================================================================
   3. UPLOAD ORGANIZER LOGO
============================================================================ */
export const uploadOrganizerLogo = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findById(req.organizerId);
  if (!organizer) throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  if (!req.file) throw new APIError(HTTP.BAD_REQUEST, "Logo file is required");

  // Delete old logo
  if (organizer.logo?.publicId) {
    await deleteFromCloudinary(organizer.logo.publicId);
  }

  const uploaded = await uploadBufferToCloudinary(
    req.file.buffer,
    "evently/organizers/logos"
  );

  // 🔥 FIX 1: correct keys
  organizer.logo = {
    url: uploaded.url,
    publicId: uploaded.publicId,
  };

  await organizer.save();

  // 🔥 FIX 2: return fresh updated version
  const updatedOrganizer = await Organizer.findById(req.organizerId);

  return res.json(
    new APIResponse(
      200,
      { organizer: updatedOrganizer },
      "Logo uploaded successfully"
    )
  );
});

/* ============================================================================
   4. UPLOAD DOCUMENTS
============================================================================ */
export const uploadOrganizerDocuments = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findById(req.organizerId);

  if (!organizer) throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  if (!req.files || req.files.length === 0)
    throw new APIError(HTTP.BAD_REQUEST, "Documents required");

  for (const file of req.files) {
    const uploaded = await uploadBufferToCloudinary(
      file.buffer,
      "evently/organizers/documents"
    );

    organizer.documents.push({
      url: uploaded.url,
      publicId: uploaded.publicId,
    });
  }

  // 🔥 Cleanup: remove old invalid documents
  organizer.documents = organizer.documents.filter(
    (doc) => doc.url && doc.publicId
  );

  await organizer.save();

  const updatedOrganizer = await Organizer.findById(req.organizerId);

  res.json(
    new APIResponse(
      200,
      { organizer: updatedOrganizer },
      "Documents uploaded successfully"
    )
  );
});

/* ============================================================================
   5. GET ORGANIZER PROFILE
============================================================================ */
export const getMyOrganizerProfile = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findById(req.organizerId);

  if (!organizer)
    throw new APIError(HTTP.NOT_FOUND, "Organizer profile not found");

  return res.json(new APIResponse(200, { organizer }));
});

/* ============================================================================
   6. UPDATE ORGANIZER PROFILE
============================================================================ */
export const updateOrganizerProfile = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findById(req.organizerId);

  if (!organizer) throw new APIError(HTTP.NOT_FOUND, "Organizer not found");

  if (organizer.status === "rejected")
    throw new APIError(HTTP.FORBIDDEN, "Organizer application rejected");

  const allowedFields = [
    "businessName",
    "phone",
    "website",
    "businessDescription",
    "category",
    "city",
    "state",
    "country",
    "address",
    "socialLinks",
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      organizer[field] = req.body[field];
    }
  }

  await organizer.save();

  return res.json(
    new APIResponse(200, { organizer }, "Organizer profile updated")
  );
});

/* ============================================================================
   7. DELETE REQUEST
============================================================================ */
export const requestOrganizerDelete = asyncHandler(async (req, res) => {
  const organizerId = req.organizerId; // ✔ use organizer middleware value

  if (!organizerId) {
    throw new APIError(HTTP.UNAUTHORIZED, "Organizer authentication required");
  }

  const organizer = await Organizer.findById(organizerId);

  if (!organizer) {
    throw new APIError(HTTP.NOT_FOUND, "Organizer not found");
  }

  if (organizer.deleteRequested) {
    throw new APIError(
      HTTP.CONFLICT,
      "Delete request already submitted. Please wait for admin approval."
    );
  }

  organizer.deleteRequested = true;
  organizer.deleteRequestedAt = new Date();

  await organizer.save();

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, null, "Deletion request submitted successfully")
    );
});

export const getMyOrganizerEvents = asyncHandler(async (req, res) => {
  const organizerId = req.organizerId;

  if (!organizerId) {
    throw new APIError(HTTP.UNAUTHORIZED, "Organizer authentication required");
  }

  const events = await Event.find({ createdBy: organizerId })
    .sort({ createdAt: -1 })
    .select(
      "title banner status startDate endDate totalViews totalRegistrations createdAt"
    );

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        { events },
        "Organizer events fetched successfully"
      )
    );
});


/* ============================================================================
   8. ORGANIZER DASHBOARD ANALYTICS
============================================================================ */
export const getOrganizerDashboard = asyncHandler(async (req, res) => {
  const organizerId = req.organizerId;

  if (!organizerId) {
    throw new APIError(HTTP.UNAUTHORIZED, "Organizer authentication required");
  }

  // 1️⃣ Fetch all organizer events
  const events = await Event.find({ createdBy: organizerId });

  // 2️⃣ Basic aggregation
  const totalEvents = events.length;
  const totalViews = events.reduce((sum, e) => sum + (e.totalViews || 0), 0);
  const totalRegistrations = events.reduce(
    (sum, e) => sum + (e.totalRegistrations || 0),
    0
  );

  // 3️⃣ Status-based breakdown
  const statusCounts = {
    draft: 0,
    published: 0,
    live: 0,
    ended: 0,
    cancelled: 0,
  };

  events.forEach((ev) => {
    if (statusCounts[ev.status] !== undefined) {
      statusCounts[ev.status]++;
    }
  });

  // 4️⃣ Recent events (latest 5)
  const recentEvents = await Event.find({ createdBy: organizerId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title banner status startDate endDate createdAt");

  // 5️⃣ Trending events (based on views/registrations)
  const trendingEvents = await Event.find({ createdBy: organizerId })
    .sort({ totalViews: -1, totalRegistrations: -1 })
    .limit(5)
    .select("title banner totalViews totalRegistrations status");

  return res.status(HTTP.OK).json(
    new APIResponse(HTTP.OK, {
      totals: {
        totalEvents,
        totalViews,
        totalRegistrations,
      },
      statusCounts,
      recentEvents,
      trendingEvents,
    },
    "Organizer dashboard analytics fetched successfully")
  );
});
