import { z } from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
});

export const ChangePasswordSchema = z
  .object({
    // Required only when the user already has a password (credential sign-in).
    // OAuth-only users (no passwordHash) may set an initial password, in which
    // case the route omits this field.
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters.")
      .max(128, "Password is too long.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;