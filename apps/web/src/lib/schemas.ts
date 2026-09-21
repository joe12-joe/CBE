import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const learnerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(60),
  middleName: z.string().max(60).optional(),
  lastName: z.string().min(1, "Last name is required").max(60),
  gender: z.enum(["M", "F"], { message: "Select a gender" }),
  dob: z.string().min(1, "Date of birth is required"),
  upi: z
    .string()
    .regex(/^\d{10}$/, "UPI must be exactly 10 digits")
    .or(z.literal(""))
    .optional(),
  nemis: z.string().max(20).optional(),
  guardianName: z.string().max(80).optional(),
  guardianPhone: z
    .string()
    .regex(/^(\+?254|0)?[17]\d{8}$/, "Enter a valid Kenyan phone number")
    .or(z.literal(""))
    .optional(),
  admissionYear: z.coerce
    .number()
    .int()
    .min(2000, "Invalid year")
    .max(2100),
});

export type LearnerFormValues = z.infer<typeof learnerSchema>;

export const commentSchema = z.object({
  teacherComment: z.string().max(300).optional(),
  nextTermFocus: z.string().max(200).optional(),
  headComment: z.string().max(300).optional(),
});

export type CommentFormValues = z.infer<typeof commentSchema>;

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(
    ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
    { message: "Select a role" }
  ),
});

export type UserFormValues = z.infer<typeof userSchema>;