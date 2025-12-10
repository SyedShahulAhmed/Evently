import ApiLog from "../models/apiLog.model.js";

export const apiLogger = async (req, res, next) => {
  const start = Date.now();

  res.on("finish", async () => {
    try {
      await ApiLog.create({
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: Date.now() - start,
        userId: req.user?._id || null,
        organizerId: req.organizer?._id || null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (err) {
      console.log("Failed to log API:", err.message);
    }
  });

  next();
};
