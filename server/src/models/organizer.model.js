import mongoose from "mongoose";
import bcrypt from "bcrypt";

const organizerSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    businessEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    phone: { type: String },
    website: { type: String },
    businessDescription: { type: String },

    logo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    documents: [
      {
        url: String,
        publicId: String,
      },
    ],

    /* 🔐 Email verification fields */
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpiry: Date,

    /* 🔐 Forgot password fields */
    forgotPasswordToken: String,
    forgotPasswordExpiry: Date,

    /* 🔁 Refresh token storage */
    refreshToken: String,

    /* 🧑‍💼 Admin approval */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "blocked"],
      default: "pending",
    },

    deleteRequested: {
      type: Boolean,
      default: false,
    },

    deleteRequestedAt: {
      type: Date,
    },

    adminNotes: { type: String },

    /* 📍 Business details */
    category: String,
    city: String,
    state: String,
    country: String,
    address: String,

    socialLinks: {
      instagram: String,
      linkedin: String,
      facebook: String,
      twitter: String,
    },
    ban: {
      isBanned: { type: Boolean, default: false },
      reason: { type: String, default: "" },
      bannedUntil: { type: Date, default: null },
    },

    /* 📊 Analytics */
    totalEventsCreated: { type: Number, default: 0 },
    totalRegistrations: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* 🔐 Password hashing */
organizerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/* 🔍 Compare password */
organizerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Organizer = mongoose.model("Organizer", organizerSchema);
export default Organizer;
