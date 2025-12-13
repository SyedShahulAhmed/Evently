import { z } from "zod";

/* ---------------------------------------------
   REGISTER VALIDATION
--------------------------------------------- */
export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),

  fullname: z
    .string()
    .trim()
    .min(3, "Full name must have at least 3 characters"),

  email: z.string().trim().email("Invalid email format"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password is too long"),
});

/* ---------------------------------------------
   LOGIN VALIDATION
--------------------------------------------- */
export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email format"),

  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "Invalid refresh token"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password too short"),
});

export const logoutSchema = z.object({
  refreshToken: z.string(),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email"),
});

