import express from "express";
import { cancelRegistration, exportRegistrationsCSV, exportRegistrationsPDF, getEventAnalytics, getEventRegistrationsForOrganizer, getMyRegistrations, registerForEvent } from "../controllers/registration.controller.js";
import {authMiddleware} from "../middlewares/authMiddleware.js";
import organizerAuth from "../middlewares/organizerAuth.middleware.js"
const router = express.Router();


// Register for an event
router.post("/:eventId/register", authMiddleware, registerForEvent);
/* USER: Get my registrations */
router.get("/me", authMiddleware, getMyRegistrations);

/* USER: Cancel my registration */
router.delete("/:registrationId", authMiddleware, cancelRegistration);

/* ORGANIZER: Get registrations for an event */
router.get(
  "/organizer/:eventId",
  organizerAuth,
  getEventRegistrationsForOrganizer
);

router.get(
  "/organizer/:eventId/analytics",
  organizerAuth,
  getEventAnalytics
);

router.get(
  "/organizer/:eventId/export/csv",
  organizerAuth,
  exportRegistrationsCSV
);

router.get(
  "/organizer/:eventId/export/pdf",
  organizerAuth,
  exportRegistrationsPDF
);


export default router;
