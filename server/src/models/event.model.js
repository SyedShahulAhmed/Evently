// src/models/event.model.js
import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String },
    category: { type: String, index: true },
    tags: [{ type: String, index: true }],
    locationType: { type: String, enum: ["online", "offline"], required: true },
    locationAddress: { type: String },
    eventURL: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    banner: MediaSchema, // required on creation (enforced by controller)
    gallery: { type: [MediaSchema], default: [] }, // max 10 enforced in controller
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "live", "ended", "cancelled"],
      default: "draft",
    },

    ticketLimit: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalRegistrations: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for search/discovery
EventSchema.index({
  title: "text",
  shortDescription: "text",
  description: "text",
  category: 1,
});

EventSchema.pre("save", function (next) {
  const now = new Date();

  if (this.startDate <= now && this.endDate >= now) {
    this.status = "live";
  } else if (this.endDate < now) {
    this.status = "ended";
  }

  next();
});

export default mongoose.model("Event", EventSchema);
