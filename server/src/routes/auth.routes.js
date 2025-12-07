import { Router } from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationEmail,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import validateSchema from "../utils/validateSchema.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "../validators/auth.schema.js";
import {
  forgotPasswordLimiter,
  loginRateLimiter,
  registerRateLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
} from "../utils/rateLimiter.js";

const router = Router();

router.post(
  "/register",
  registerRateLimiter,validateSchema(registerSchema),
  registerUser
);

router.post("/login", loginRateLimiter, validateSchema(loginSchema), loginUser);

router.get("/verify-email/:token", verifyEmail);

router.post("/resend-verification", resendVerificationEmail);

router.post(
  "/refresh-token",
  validateSchema(refreshTokenSchema),
  refreshAccessToken
);

router.post("/logout", validateSchema(logoutSchema), logoutUser);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateSchema(forgotPasswordSchema),
  forgotPassword
);

router.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  validateSchema(resetPasswordSchema),
  resetPassword
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validateSchema(resendVerificationSchema),
  resendVerificationEmail
);

export default router;
