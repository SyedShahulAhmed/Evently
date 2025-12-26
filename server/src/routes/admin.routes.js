import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import {
  getAllOrganizers,
  getPendingOrganizers,
  getOrganizerById,
  approveOrganizer,
  rejectOrganizer,
  blockOrganizer,
  unblockOrganizer,
  getOrganizerDeleteRequests,
  deleteOrganizerPermanently,
} from "../controllers/adminOrganizer.controller.js";
import {
  blockUser,
  deleteUserPermanently,
  getAllUsers,
  unblockUser,
} from "../controllers/adminUser.controller.js";
import { getDailyRegistrations, getMonthlyGrowth, getPlatformStats, getRegistrationTrend, getTopEvents, getTopOrganizers } from "../controllers/admin.analytics.controller.js";
import { adminBanOrganizer, adminDeleteEvent, adminFeatureEvent, adminRemoveInappropriateEvent, adminUnbanOrganizer, adminUnfeatureEvent } from "../controllers/admin.event.controller.js";
import { getApiLogs, getAuditLogs, getErrorLogs } from "../controllers/admin.logs.controller.js";

const router = Router();

// protect all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);
router.get(
  "/organizers/delete-requests",
  authMiddleware,
  adminMiddleware,
  getOrganizerDeleteRequests
);
// PART 2 ROUTES
router.get("/organizers", getAllOrganizers);
router.get("/organizers/pending", getPendingOrganizers);
router.get("/organizers/:id", getOrganizerById);
router.put("/organizers/:id/approve", approveOrganizer);
router.put("/organizers/:id/reject", rejectOrganizer);
router.put("/organizers/:id/block", blockOrganizer);
router.put("/organizers/:id/unblock", unblockOrganizer);
router.delete(
  "/organizers/:id",
  authMiddleware,
  adminMiddleware,
  deleteOrganizerPermanently
);

//USER
router.get("/users", authMiddleware, adminMiddleware, getAllUsers);
router.put("/users/:id/block", authMiddleware, adminMiddleware, blockUser);
router.put("/users/:id/unblock", authMiddleware, adminMiddleware, unblockUser);
router.delete(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  deleteUserPermanently
);

//Analytics
router.get("/analytics/stats", getPlatformStats);
router.get("/analytics/top-organizers", getTopOrganizers);
router.get("/analytics/top-events", getTopEvents);
router.get("/analytics/daily-registrations", getDailyRegistrations);
router.get("/analytics/monthly-growth", getMonthlyGrowth);
router.get("/analytics/registration-trend", getRegistrationTrend);

//  Audit logs 
router.get("/logs/audit", getAuditLogs);
router.get("/logs/api", getApiLogs);
router.get("/logs/errors", getErrorLogs);

/* Day 7 — Event moderation */
router.delete("/events/:eventId", adminDeleteEvent);
router.put("/events/:eventId/feature", adminFeatureEvent);
router.put("/events/:eventId/unfeature", adminUnfeatureEvent);
router.post("/events/:eventId/remove", adminRemoveInappropriateEvent); // body: reason

/* Ban/unban organizer */
router.put("/organizers/:organizerId/ban", adminBanOrganizer); // body: { days, reason }
router.put("/organizers/:organizerId/unban", adminUnbanOrganizer);



export default router;
