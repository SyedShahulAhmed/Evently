import mongoose from "mongoose";

const BookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate bookmarks for same event by same user
BookmarkSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export default mongoose.model("Bookmark", BookmarkSchema);
