import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import organizerAuth from "../middlewares/organizerAuth.middleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";

import {
  getUserNotifications,
  getOrganizerNotifications,
  getAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  organizerDeleteAllNotifications,
  organizerDeleteNotification,
  organizerMarkAllRead,
  organizerMarkRead,
  adminDeleteAllNotifications,
  adminDeleteNotification,
  adminMarkAllRead,
  adminMarkRead,
} from "../controllers/notification.controller.js";

const router = Router();

/* ========================================================================
   ORGANIZER ROUTES — MUST COME FIRST (to prevent fallback conflicts)
========================================================================= */
router.get("/organizer", organizerAuth, getOrganizerNotifications);

router.put("/organizer/mark-read/:id", organizerAuth, organizerMarkRead);

router.put("/organizer/mark-all-read", organizerAuth, organizerMarkAllRead);

router.delete("/organizer/:id", organizerAuth, organizerDeleteNotification);

router.delete("/organizer", organizerAuth, organizerDeleteAllNotifications);

/* ========================================================================
   USER ROUTES
========================================================================= */
router.get(
  "/user",
  authMiddleware,
  authorizeRoles("user"),
  getUserNotifications
);

router.put(
  "/user/mark-read/:id",
  authMiddleware,
  authorizeRoles("user"),
  markNotificationRead
);

router.put(
  "/user/mark-all-read",
  authMiddleware,
  authorizeRoles("user"),
  markAllNotificationsRead
);

router.delete(
  "/user/:id",
  authMiddleware,
  authorizeRoles("user"),
  deleteNotification
);

router.delete(
  "/user",
  authMiddleware,
  authorizeRoles("user"),
  deleteAllNotifications
);

/* ========================================================================
   ADMIN ROUTES
========================================================================= */
router.get(
  "/admin",
  authMiddleware,
  authorizeRoles("admin"),
  getAdminNotifications
);
router.put(
  "/admin/mark-read/:id",
  authMiddleware,
  authorizeRoles("admin"),
  adminMarkRead
);
router.put(
  "/admin/mark-all-read",
  authMiddleware,
  authorizeRoles("admin"),
  adminMarkAllRead
);
router.delete(
  "/admin/:id",
  authMiddleware,
  authorizeRoles("admin"),
  adminDeleteNotification
);
router.delete(
  "/admin",
  authMiddleware,
  authorizeRoles("admin"),
  adminDeleteAllNotifications
);

export default router;
