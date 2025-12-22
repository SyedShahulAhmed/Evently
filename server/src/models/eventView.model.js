import mongoose from "mongoose";

const EventViewSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // guest views allowed
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("EventView", EventViewSchema);
