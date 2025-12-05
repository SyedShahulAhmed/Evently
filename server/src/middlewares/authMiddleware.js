import asyncHandler from "../utils/asyncHandler.js";
import APIError from "../utils/APIError.js";
import { verifyAccessToken } from "../utils/jwtProvider.js";
import User from "../models/user.model.js";
import { HTTP } from "../constants/httpStatus.js";

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new APIError(HTTP.UNAUTHORIZED, "Authentication required");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new APIError(HTTP.UNAUTHORIZED, "User not found");
    }

    if (user.isBlocked) {
      throw new APIError(HTTP.FORBIDDEN, "Your account has been blocked");
    }
    
    // FIXED 🔥 use isEmailVerified, NOT verified
    if (!user.isEmailVerified) {
      throw new APIError(
        HTTP.FORBIDDEN,
        "Email not verified. Please verify first."
      );
    }

    req.user = user;
    next();
  } catch (err) {
    throw new APIError(HTTP.UNAUTHORIZED, err.message);
  }
});
