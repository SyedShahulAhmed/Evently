import express from "express";
import { getAllEvents, getEventDetails, getFeaturedEvents, getOrganizerPublicProfile, getRelatedEvents, getTrendingEvents, searchEvents } from "../controllers/publicEvent.controller.js";

const router = express.Router();

// PUBLIC EVENT LISTING
router.get("/", getAllEvents);
router.get("/search", searchEvents);
router.get("/trending", getTrendingEvents);
router.get("/:eventId", getEventDetails);
router.get("/:eventId/related", getRelatedEvents);
router.get("/organizer/:organizerId", getOrganizerPublicProfile);
router.get("/featured/list",getFeaturedEvents)

export default router;
