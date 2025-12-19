// src/routes/event.routes.js
import express from "express";
import {
  createEvent,
  deleteEvent,
  duplicateEvent,
  organizerGetMyEvents,
  publishEvent,
  unpublishEvent,
  updateEvent,
} from "../controllers/event.controller.js";

import organizerAuth from "../middlewares/organizerAuth.middleware.js";
import { uploadEventMedia } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/**
 * GET ALL ORGANIZER EVENTS
 * GET /api/v1/organizer/events/
 */
router.get(
  "/my-events",
  organizerAuth,
  organizerGetMyEvents
);

/**
 * CREATE EVENT
 * POST /api/v1/organizer/events/add-event
 */
router.post(
  "/add-event",
  organizerAuth,
  uploadEventMedia,
  createEvent
);

/**
 * UPDATE EVENT
 * PUT /api/v1/organizer/events/update/:eventId
 */
router.put(
  "/update/:eventId",
  organizerAuth,
  uploadEventMedia,
  updateEvent
);

/**
 * DELETE EVENT
 * DELETE /api/v1/organizer/events/delete/:eventId
 */
router.delete(
  "/delete/:eventId",
  organizerAuth,
  deleteEvent
);

/**
 * DUPLICATE EVENT
 * POST /api/v1/organizer/events/duplicate/:eventId
 */
router.post(
  "/duplicate/:eventId",
  organizerAuth,
  duplicateEvent
);

router.put(
  "/publish/:eventId",
  organizerAuth,
  publishEvent
);

router.put(
  "/unpublish/:eventId",
  organizerAuth,
  unpublishEvent
);

export default router;
