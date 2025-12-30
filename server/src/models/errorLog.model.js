import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema(
  {
    message: String,
    stack: String,
    route: String,
    method: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "Organizer", default: null },
    ipAddress: String,
  },
  { timestamps: true }
);

export default mongoose.model("ErrorLog", errorLogSchema);
