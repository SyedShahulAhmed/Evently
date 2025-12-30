import mongoose from "mongoose";

const apiLogSchema = new mongoose.Schema(
  {
    method: String,
    endpoint: String,
    statusCode: Number,
    responseTime: Number,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "Organizer", default: null },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

export default mongoose.model("ApiLog", apiLogSchema);
