import ErrorLog from "../models/errorLog.model.js";

export const errorLogger = async (err, req, res, next) => {
  try {
    await ErrorLog.create({
      message: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
      userId: req.user?._id || null,
      organizerId: req.organizer?._id || null,
      ipAddress: req.ip,
    });
  } catch (e) {
    console.log("Error log save failed:", e.message);
  }

  next(err);
};
