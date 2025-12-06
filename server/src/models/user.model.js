import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    fullname: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
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

    role: {
      type: String,
      enum: ["user", "organizer", "admin"],
      default: "user",
    },

    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      localpath: { type: String, default: "" },
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: String,
    emailVerificationExpiry: Date,

    forgotPasswordToken: String,
    forgotPasswordExpiry: Date,

    refreshToken: String,
    // 🔐 Brute-force protection
    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

/* ---------------------------
   PASSWORD HASHING
---------------------------- */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Hash password with salt rounds = 10
  this.password = await bcrypt.hash(this.password, 10);

  next();
});

/* ---------------------------
   PASSWORD COMPARISON
---------------------------- */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
