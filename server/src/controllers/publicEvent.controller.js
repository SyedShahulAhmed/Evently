import Event from "../models/event.model.js";
import APIResponse from "../utils/APIResponse.js";
import APIError from "../utils/APIError.js";
import asyncHandler from "../utils/asyncHandler.js";
import Organizer from "../models/organizer.model.js"
import EventView from "../models/eventView.model.js";
import { HTTP } from "../constants/httpStatus.js";
// -------------------------------------------
// PUBLIC: GET ALL PUBLISHED EVENTS 
// -------------------------------------------
export const getAllEvents = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Base filter → Only published events
  const filter = { status: "published" };

  // -------------------------
  // CATEGORY FILTER
  // -------------------------
  if (req.query.category) {
    filter.category = req.query.category;
  }

  // -------------------------
  // LOCATION FILTER
  // -------------------------
  if (req.query.locationType) {
    filter.locationType = req.query.locationType; // online/offline
  }

  // -------------------------
  // DATE FILTER
  // -------------------------
  if (req.query.date) {
    const now = new Date();

    if (req.query.date === "upcoming") {
      filter.startDate = { $gte: now };
    }

    if (req.query.date === "today") {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));
      filter.startDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (req.query.date === "week") {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 7);
      filter.startDate = { $gte: start, $lte: end };
    }

    if (req.query.date === "month") {
      const start = new Date();
      const end = new Date();
      end.setMonth(start.getMonth() + 1);
      filter.startDate = { $gte: start, $lte: end };
    }
  }

  const events = await Event.find(filter)
    .sort({ startDate: 1 }) // upcoming first
    .skip(skip)
    .limit(limit);

  const total = await Event.countDocuments(filter);

  return res.status(200).json(
    new APIResponse(200, {
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
});


export const searchEvents = asyncHandler(async (req, res) => {
  const q = req.query.q?.trim();

  if (!q) {
    throw new APIError(400, "Search query 'q' is required");
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Search only published events
  const filter = {
    status: "published",
    $text: { $search: q }
  };

  const events = await Event.find(filter)
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .select("-gallery");

  const total = await Event.countDocuments(filter);

  return res.status(200).json(
    new APIResponse(200, {
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      query: q,
    })
  );
});


export const getTrendingEvents = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 10;

  const events = await Event.aggregate([
    {
      $match: {
        status: "published"
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            "$totalViews",
            { $multiply: ["$totalRegistrations", 5] }
          ]
        }
      }
    },
    {
      $sort: { trendingScore: -1, createdAt: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        gallery: 0
      }
    }
  ]);

  return res.status(200).json(
    new APIResponse(200, { events })
  );
});


export const getEventDetails = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findOne({
    _id: eventId,
    status: "published"
  }).populate("createdBy", "businessName logo city state");

  if (!event) {
    throw new APIError(404, "Event not found");
  }

  /* ------------------------ LOG EVENT VIEW ------------------------ */
  await EventView.create({
    eventId: event._id,
    userId: req.user?._id || null, // supports guest users
  });

  /* ------------------------ UPDATE TOTAL VIEWS --------------------- */
  event.totalViews = (event.totalViews || 0) + 1;
  await event.save();

  return res.status(200).json(
    new APIResponse(200, { event })
  );
});



export const getRelatedEvents = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const baseEvent = await Event.findById(eventId);

  if (!baseEvent) {
    throw new APIError(404, "Event not found");
  }

  const related = await Event.find({
    _id: { $ne: eventId },
    status: "published",
    $or: [
      { category: baseEvent.category },
      { tags: { $in: baseEvent.tags } },
      { locationType: baseEvent.locationType }
    ]
  })
    .limit(Number(req.query.limit) || 5)
    .select("-gallery") // lightweight
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new APIResponse(200, { related })
  );
});


export const getOrganizerPublicProfile = asyncHandler(async (req, res) => {
  const { organizerId } = req.params;

  const organizer = await Organizer.findById(organizerId)
    .select("businessName logo city state category businessDescription socialLinks coverImage");

  if (!organizer) {
    throw new APIError(404, "Organizer not found");
  }

  // Recent events (last 6 published)
  const recentEvents = await Event.find({
    createdBy: organizerId,
    status: "published"
  })
    .select("title banner startDate endDate category locationType")
    .limit(6)
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new APIResponse(200, {
      organizer,
      recentEvents,
    })
  );
});


export const getFeaturedEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ isFeatured: true, status: "published" })
    .sort({ createdAt: -1 })
    .select("title banner startDate endDate shortDescription category createdBy");

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(HTTP.OK, { events }, "Featured events fetched successfully")
    );
});