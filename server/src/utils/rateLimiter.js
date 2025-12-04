import rateLimit from "express-rate-limit";
import APIError from "./APIError.js";
import { HTTP } from "../constants/httpStatus.js";

export const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Max 10 attempts

  handler: (_, __, next) => {
    return next(
      new APIError(
        HTTP.TOO_MANY_REQUESTS,
        "Too many login attempts. Please try again later."
      )
    );
  },

  standardHeaders: true,
  legacyHeaders: false,
});
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 3,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
export const forgotPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 3,
  message: {
    success: false,
    message: "Too many password reset requests. Try again later.",
  },
});
export const resetPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
});
export const resendVerificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
});
