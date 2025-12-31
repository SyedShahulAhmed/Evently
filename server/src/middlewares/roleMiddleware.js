import APIError from "../utils/APIError.js";
import { HTTP } from "../constants/httpStatus.js";

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user)
      throw new APIError(HTTP.UNAUTHORIZED, "Not authenticated");

    if (!allowedRoles.includes(req.user.role)) {
      throw new APIError(
        HTTP.FORBIDDEN,
        "You do not have permission to access this resource"
      );
    }

    next();
  };
};
