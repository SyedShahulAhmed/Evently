import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import { HTTP } from "../constants/httpStatus.js";
import { verifyAccessToken } from "../utils/jwtProvider.js";
import Organizer from "../models/organizer.model.js";

const organizerAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new APIError(HTTP.UNAUTHORIZED, "Organizer token required");
  }

  const token = header.split(" ")[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new APIError(HTTP.UNAUTHORIZED, "Invalid or expired token");
  }

  // Payload.id must be ORGANIZER ID
  const organizer = await Organizer.findById(payload.id);

  if (!organizer) {
    throw new APIError(HTTP.FORBIDDEN, "Organizer account not found");
  }

  if (organizer.status !== "approved") {
    throw new APIError(HTTP.FORBIDDEN, "Organizer not approved");
  }

  req.organizer = organizer;
  req.organizerId = organizer._id;

  next();
});

export default organizerAuth;
