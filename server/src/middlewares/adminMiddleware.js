import APIError from "../utils/APIError.js";
import { HTTP } from "../constants/httpStatus.js";

export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    throw new APIError(HTTP.UNAUTHORIZED, "User authentication required");
  }

  if (req.user.role !== "admin") {
    throw new APIError(HTTP.FORBIDDEN, "Admin access required");
  }

  next();
};
