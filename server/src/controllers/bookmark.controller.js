import Bookmark from "../models/bookmark.model.js";
import Event from "../models/event.model.js";
import APIResponse from "../utils/APIResponse.js";
import APIError from "../utils/APIError.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * TOGGLE BOOKMARK
 * If bookmarked → remove it
 * If not bookmarked → add it
 */
export const toggleBookmark = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // Check event exists
  const event = await Event.findById(eventId);
  if (!event) throw new APIError(404, "Event not found");

  // Check if already bookmarked
  const existing = await Bookmark.findOne({
    userId: req.user._id,
    eventId,
  });

  // If exists → remove bookmark
  if (existing) {
    await existing.deleteOne();

    return res.status(200).json(
      new APIResponse(
        200,
        { isBookmarked: false },
        "Bookmark removed"
      )
    );
  }

  // Otherwise → add bookmark
  await Bookmark.create({
    userId: req.user._id,
    eventId,
  });

  return res.status(201).json(
    new APIResponse(
      201,
      { isBookmarked: true },
      "Bookmarked successfully"
    )
  );
});

/**
 * GET MY BOOKMARKS
 */
export const getMyBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await Bookmark.find({ userId: req.user._id })
    .populate("eventId", "title banner startDate endDate locationType status")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new APIResponse(200, { bookmarks })
  );
});
