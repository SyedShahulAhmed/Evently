// src/validators/event.schema.js
import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    shortDescription: z.string().optional(),
    description: z.string().optional(),

    category: z.string().optional(),
    tags: z
      .string()
      .optional()
      .transform(val => val ? val.split(",") : []),  // FIX FOR FORM-DATA

    locationType: z.enum(["online", "offline"]),
    locationAddress: z.string().optional(),
    eventURL: z.string().optional(),

    startDate: z.string(),
    endDate: z.string(),

    ticketLimit: z
      .string()
      .optional()
      .transform(val => Number(val) || 0),           // FIX FOR FORM-DATA

    status: z.enum(["draft", "published", "completed", "cancelled"]).optional(),
  })
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    shortDescription: z.string().max(200).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    // Accept CSV string for tags from form-data, or JSON array
    tags: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        if (Array.isArray(val)) return val;
        return val.split(",").map((t) => t.trim()).filter(Boolean);
      }),
    locationType: z.enum(["online", "offline"]).optional(),
    locationAddress: z.string().optional(),
    eventURL: z.string().optional(),
    startDate: z.string().optional().refine((s) => !s || !isNaN(Date.parse(s)), { message: "Invalid startDate" }),
    endDate: z.string().optional().refine((s) => !s || !isNaN(Date.parse(s)), { message: "Invalid endDate" }),
    ticketLimit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined ? undefined : Number(v))),
    status: z.enum(["draft", "published", "completed", "cancelled"]).optional(),
    // flags for gallery behavior (sent as form-data text)
    replaceGallery: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((v) => (v === undefined ? false : (v === "true" || v === true))),
    // removeGalleryPublicIds: csv of publicIds to remove from existing gallery
    removeGalleryPublicIds: z.string().optional(),
  })
});

export const duplicateEventSchema = z.object({
  params: z.object({
    eventId: z.string().min(1),
  }),
  body: z.object({
    // optional: new start/end dates
    startDate: z.string().optional().refine((s) => !s || !isNaN(Date.parse(s)), { message: "Invalid startDate" }),
    endDate: z.string().optional().refine((s) => !s || !isNaN(Date.parse(s)), { message: "Invalid endDate" }),
  }).optional()
});