import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getMyBookmarks,
  toggleBookmark,
} from "../controllers/bookmark.controller.js";

const router = express.Router();

router.use(authMiddleware); // user must be logged in

router.post("/:eventId", toggleBookmark);

// Get all bookmarks
router.get("/", getMyBookmarks);

export default router;
