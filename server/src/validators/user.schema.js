import { z } from "zod";


export const userUpdateSchema = z.object({
  fullname: z.string().optional(),
  username: z.string().min(3).optional(),
});

export const userPasswordUpdateSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6),
});
