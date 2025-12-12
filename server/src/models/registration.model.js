import mongoose from "mongoose";

const RegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    qrCode: {
      type: String, // base64 or secure QR string
      required: true,
    },
    status: {
      type: String,
      enum: ["registered", "cancelled"],
      default: "registered",
    },
  },
  { timestamps: true }
);

// Prevent same user registering twice for same event
RegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const Registration = mongoose.model("Registration", RegistrationSchema);
export default Registration