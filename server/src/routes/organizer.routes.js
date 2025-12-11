// src/routes/organizer.routes.js
import { Router } from "express";
import validateSchema from "../utils/validateSchema.js";

import {
  registerOrganizer,
  loginOrganizer,
  uploadOrganizerLogo,
  uploadOrganizerDocuments,
  updateOrganizerProfile,
  getMyOrganizerProfile,
  requestOrganizerDelete,
  getMyOrganizerEvents,
  getOrganizerDashboard,
} from "../controllers/organizer.controller.js";

import {
  uploadSingle,
  uploadMultiple,
} from "../middlewares/uploadMiddleware.js";

import {
  organizerRegisterSchema,
  organizerLoginSchema,
  organizerProfileUpdateSchema,
} from "../validators/organizer.schema.js";

import organizerAuth from "../middlewares/organizerAuth.middleware.js";

const router = Router();

/* ======================
   PUBLIC ORGANIZER ROUTES
========================*/

// Register organizer
router.post(
  "/register",
  validateSchema(organizerRegisterSchema),
  registerOrganizer
);

// Login organizer
router.post(
  "/login",
  validateSchema(organizerLoginSchema),
  loginOrganizer
);

/* ======================
   PROTECTED ORGANIZER ROUTES
========================*/
router.use(organizerAuth);

// Get my organizer profile
router.get("/me", getMyOrganizerProfile);

// Update organizer business profile
router.put(
  "/me",
  validateSchema(organizerProfileUpdateSchema),
  updateOrganizerProfile
);

// Upload logo (correct ordering)
router.post(
  "/me/logo",
  uploadSingle("logo"),
  uploadOrganizerLogo
);

// Upload documents (no duplicate organizerAuth)
router.post(
  "/me/documents",
  uploadMultiple("documents", 10),
  uploadOrganizerDocuments
);

// Request account deletion
router.post(
  "/me/delete-request",
  requestOrganizerDelete
);

// Get all events created by this organizer
router.get(
  "/events",
  getMyOrganizerEvents
);

router.get("/dashboard", organizerAuth, getOrganizerDashboard);


export default router;
