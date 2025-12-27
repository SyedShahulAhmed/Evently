import asyncHandler from "../utils/asyncHandler.js";
import APIResponse from "../utils/APIResponse.js";
import { HTTP } from "../constants/httpStatus.js";
import User from "../models/user.model.js";
import Organizer from "../models/organizer.model.js";
import Event from "../models/event.model.js";
import Registration from "../models/registration.model.js";

/* ----------------- Platform Summary ----------------- */
export const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalOrganizers,
    totalEvents,
    totalRegistrations,
    totalViews,
  ] = await Promise.all([
    User.countDocuments(),
    Organizer.countDocuments(),
    Event.countDocuments(),
    Registration.countDocuments(),
    Event.aggregate([
      { $group: { _id: null, views: { $sum: "$totalViews" } } },
    ]),
  ]);

  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      {
        totalUsers,
        totalOrganizers,
        totalEvents,
        totalRegistrations,
        totalViews: totalViews[0]?.views || 0,
      },
      "Enhanced platform stats"
    )
  );
});

/* ----------------- Top Organizers (by events and registrations) ----------------- */
export const getTopOrganizers = asyncHandler(async (req, res) => {
  // 🔹 Top by number of events
  const byEvents = await Event.aggregate([
    { $group: { _id: "$createdBy", eventsCount: { $sum: 1 } } },
    { $sort: { eventsCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "organizers",
        localField: "_id",
        foreignField: "_id",
        as: "organizer"
      }
    },
    { $unwind: "$organizer" },
    {
      $project: {
        eventsCount: 1,
        organizer: {
          _id: 1,
          businessName: "$organizer.businessName"
        }
      }
    }
  ]);

  // 🔹 Top by total registrations
  const byRegistrations = await Registration.aggregate([
    {
      $lookup: {
        from: "events",
        localField: "eventId",
        foreignField: "_id",
        as: "event"
      }
    },
    { $unwind: "$event" },
    { $group: { _id: "$event.createdBy", registrations: { $sum: 1 } } },
    { $sort: { registrations: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "organizers",
        localField: "_id",
        foreignField: "_id",
        as: "organizer"
      }
    },
    { $unwind: "$organizer" },
    {
      $project: {
        registrations: 1,
        organizer: {
          _id: 1,
          businessName: "$organizer.businessName"
        }
      }
    }
  ]);

  return res.status(HTTP.OK).json(
    new APIResponse(
      HTTP.OK,
      { byEvents, byRegistrations },
      "Top organizers"
    )
  );
});


/* ----------------- Top Events (by registrations) ----------------- */
export const getTopEvents = asyncHandler(async (req, res) => {
  const events = await Event.aggregate([
    {
      $lookup: {
        from: "registrations",
        localField: "_id",
        foreignField: "eventId",
        as: "regs",
      },
    },
    {
      $addFields: {
        registrations: { $size: "$regs" },
        score: {
          $add: ["$totalViews", { $multiply: [{ $size: "$regs" }, 5] }],
        },
      },
    },
    { $sort: { score: -1 } },
    { $limit: 10 },
    {
      $project: {
        title: 1,
        score: 1,
        totalViews: 1,
        registrations: 1,
      },
    },
  ]);

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, { events }, "Top performing events"));
});

/* ----------------- Daily registrations (last N days) ----------------- */
export const getDailyRegistrations = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 30);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);

  const raw = await Registration.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill missing days
  const filled = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const dayStr = dt.toISOString().split("T")[0];

    const matched = raw.find((r) => r._id === dayStr);

    filled.push({
      date: dayStr,
      count: matched ? matched.count : 0,
    });
  }

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        { daily: filled },
        "Daily registrations (filled)"
      )
    );
});

/* ----------------- Monthly growth (last 12 months) ----------------- */
export const getMonthlyGrowth = asyncHandler(async (req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  async function getGrowth(model) {
    const data = await model.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // calculate growth %
    return data.map((item, index) => ({
      month: item._id,
      count: item.count,
      growth:
        index === 0
          ? 0
          : ((item.count - data[index - 1].count) / data[index - 1].count) *
            100,
    }));
  }

  const [users, organizers, events] = await Promise.all([
    getGrowth(User),
    getGrowth(Organizer),
    getGrowth(Event),
  ]);

  return res
    .status(HTTP.OK)
    .json(
      new APIResponse(
        HTTP.OK,
        { users, organizers, events },
        "Monthly growth with %"
      )
    );
});

/* ----------------- Registration trend API (customizable) ----------------- */
export const getRegistrationTrend = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const match = {};

  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo);
  }

  const trend = await Registration.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        registrations: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, { trend }, "Optimized registration trend"));
});
