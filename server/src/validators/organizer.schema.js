// src/validators/organizer.schema.js
import { z } from "zod";

export const organizerRegisterSchema = z.object({
  businessName: z.string().min(3),
  businessEmail: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  businessDescription: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
});

export const organizerLoginSchema = z.object({
  businessEmail: z.string().email(),
  password: z.string().min(6),
});

export const organizerProfileUpdateSchema = z.object({
  businessName: z.string().min(3).optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  businessDescription: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  socialLinks: z
    .object({
      instagram: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      facebook: z.string().url().optional(),
      twitter: z.string().url().optional(),
    })
    .optional(),
});
