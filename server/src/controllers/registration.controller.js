import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import Event from "../models/event.model.js";
import Registration from "../models/registration.model.js";
import QRCode from "qrcode";
import { HTTP } from "../constants/httpStatus.js";
import { Parser } from "json2csv";
import PDFDocument from "pdfkit";
import EventView from "../models/eventView.model.js";
import {
  sendEventCancelledEmail,
  sendInAppNotification,
  sendRegistrationSuccessEmail,
  sendTicketEmail,
} from "../services/notification.service.js";
import User from "../models/user.model.js";
/* ---------------------- REGISTER FOR EVENT ---------------------- */

export const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?._id;

  const event = await Event.findById(eventId);
  if (!event || event.status !== "published") {
    throw new APIError(HTTP.NOT_FOUND, "Event not available for registration");
  }

  // Check existing registration
  const existing = await Registration.findOne({ eventId, userId });

  if (existing && existing.status === "registered") {
    return res
      .status(HTTP.CONFLICT)
      .json(
        new APIResponse(
          HTTP.CONFLICT,
          { already: true },
          "You have already registered for this event"
        )
      );
  }

  // Ticket limit
  if (event.ticketLimit > 0 && event.totalRegistrations >= event.ticketLimit) {
    throw new APIError(HTTP.BAD_REQUEST, "Tickets sold out");
  }

  // Prevent late registration
  if (new Date(event.startDate) <= new Date()) {
    throw new APIError(HTTP.BAD_REQUEST, "Event has already started");
  }

  // Remove cancelled registration to re-register
  if (existing && existing.status === "cancelled") {
    await Registration.deleteOne({ _id: existing._id });
  }

  const qrCode = await QRCode.toDataURL(`${eventId}-${userId}-${Date.now()}`);

  const registration = await Registration.create({
    eventId,
    userId,
    qrCode,
    status: "registered",
  });

  // Increment event count
  event.totalRegistrations += 1;
  await event.save();

  /* ----------------------------------------------------
     🔔 EMAIL + IN-APP NOTIFICATIONS START FROM HERE
  ----------------------------------------------------- */

  const user = await User.findById(userId);

  // 3️⃣ In-App Notification
  await sendInAppNotification({
    userId,
    title: "Registration Successful",
    message: `You have successfully registered for ${event.title}.`,
    type: "success",
  });

  await sendInAppNotification({
    userId: user._id,
    title: "Ticket Generated",
    message: `Your ticket (QR code) for ${event.title} is ready.`,
    type: "info",
  });

  /* ----------------------------------------------------
     🔔 EMAIL + IN-APP NOTIFICATIONS END HERE
  ----------------------------------------------------- */

  return res
    .status(HTTP.CREATED)
    .json(
      new APIResponse(HTTP.CREATED, { registration }, "Registered successfully")
    );
});

/* ---------------------- USER HISTORY ---------------------- */
export const getMyRegistrations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const registrations = await Registration.find({
    userId,
    status: "registered", // only active
  })
    .populate("eventId", "title banner startDate endDate")
    .sort({ createdAt: -1 });

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        { registrations },
        "Registration history fetched"
      )
    );
});

/* ---------------------- CANCEL REGISTRATION ---------------------- */
export const cancelRegistration = asyncHandler(async (req, res) => {
  const { registrationId } = req.params;
  const registration = await Registration.findById(registrationId);

  if (!registration)
    throw new APIError(HTTP.NOT_FOUND, "Registration not found");

  if (registration.status === "cancelled") {
    return res
      .status(HTTP.OK)
      .json(new APIResponse(HTTP.OK, {}, "Already cancelled"));
  }

  const event = await Event.findById(registration.eventId);

  // Check ownership
  if (registration.userId.toString() !== req.user._id.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "You cannot cancel this registration");
  }

  // Check 24-hour rule
  const hoursLeft = (new Date(event.startDate) - new Date()) / (1000 * 60 * 60);

  if (hoursLeft < 24) {
    throw new APIError(
      HTTP.BAD_REQUEST,
      "Cannot cancel within 24 hours of event start"
    );
  }

  registration.status = "cancelled";
  await registration.save();

  // Update event count
  event.totalRegistrations = Math.max(0, event.totalRegistrations - 1);
  await event.save();

  /* ---------------------- 🔔 EMAIL + NOTIFICATION ---------------------- */
  const user = await User.findById(req.user._id);

  // In-app notification
  await sendInAppNotification({
    userId: user._id,
    title: "Registration Cancelled",
    message: `You have cancelled your registration for ${event.title}.`,
    type: "warning",
  });
  /* ---------------------------------------------------------------------- */

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, {}, "Registration cancelled"));
});

/* ---------------------- ORGANIZER REG LIST ---------------------- */
export const getEventRegistrationsForOrganizer = asyncHandler(
  async (req, res) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

    if (event.createdBy.toString() !== req.organizerId.toString()) {
      throw new APIError(HTTP.FORBIDDEN, "You do not own this event");
    }

    const registrations = await Registration.find({
      eventId,
      status: "registered",
    })
      .populate("userId", "fullname email avatar")
      .sort({ createdAt: -1 });

    return res
      .status(HTTP.OK)
      .json(
        new APIResponse(
          HTTP.OK,
          { registrations },
          "Event registrations fetched"
        )
      );
  }
);

export const getEventAnalytics = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  // Check organizer owns event
  if (event.createdBy.toString() !== req.organizerId.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "You do not own this event");
  }

  const now = new Date();
  const last30 = new Date();
  last30.setDate(now.getDate() - 30);

  /* ------------------------ DAILY VIEWS ------------------------ */
  const dailyViews = await EventView.aggregate([
    {
      $match: {
        eventId: event._id,
        viewedAt: { $gte: last30 },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$viewedAt" },
        },
        views: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  /* --------------------- DAILY REGISTRATIONS -------------------- */
  const dailyRegistrations = await Registration.aggregate([
    {
      $match: {
        eventId: event._id,
        createdAt: { $gte: last30 },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        registrations: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  /* ------------------------- META DATA ------------------------- */
  const conversionRate =
    event.totalViews === 0
      ? "0%"
      : ((event.totalRegistrations / event.totalViews) * 100).toFixed(2) + "%";

  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      {
        totalViews: event.totalViews,
        totalRegistrations: event.totalRegistrations,
        conversionRate,
        dailyViews,
        dailyRegistrations,
      },
      "Analytics fetched"
    )
  );
});

export const exportRegistrationsCSV = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  if (event.createdBy.toString() !== req.organizerId.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "You do not own this event");
  }

  const data = await Registration.find({ eventId })
    .populate("userId", "fullname email")
    .sort({ createdAt: -1 });

  const rows = data.map((r) => ({
    fullname: r.userId.fullname,
    email: r.userId.email,
    status: r.status,
    registrationDate: r.createdAt,
  }));

  const parser = new Parser();
  const csv = parser.parse(rows);

  res.header("Content-Type", "text/csv");
  res.attachment(`registrations_${eventId}.csv`);
  return res.send(csv);
});

export const exportRegistrationsPDF = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new APIError(HTTP.NOT_FOUND, "Event not found");

  if (event.createdBy.toString() !== req.organizerId.toString()) {
    throw new APIError(HTTP.FORBIDDEN, "You do not own this event");
  }

  const registrations = await Registration.find({ eventId })
    .populate("userId", "fullname email")
    .sort({ createdAt: -1 });

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="registrations_${eventId}.pdf"`
  );

  doc.pipe(res);

  doc.fontSize(22).text("Event Registration Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(16).text(`Event: ${event.title}`);
  doc.moveDown();

  registrations.forEach((r, i) => {
    doc.fontSize(12).text(`${i + 1}. ${r.userId.fullname} — ${r.userId.email}`);
    doc.text(`Status: ${r.status}`);
    doc.text(`Date: ${r.createdAt}`);
    doc.moveDown();
  });

  doc.end();
});
