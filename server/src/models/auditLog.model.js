import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // optional affected user
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "Organizer", default: null }, // optional
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null }, // optional
  action: { type: String, required: true }, // e.g. "organizer_approved"
  module: { type: String, required: true }, // e.g. "organizers", "events"
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // JSON details
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
