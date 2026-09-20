import { z } from "zod";

export const registerFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z
      .string()
      .trim()
      .max(254)
      .email("Enter a valid email")
      .transform((value) => value.toLowerCase()),
    password: z.string().min(10, "Password must be at least 10 characters").max(200),
    confirmPassword: z.string(),
    department: z.string().trim().min(1, "Enter your department").max(80),
    jobTitle: z.string().trim().min(1, "Enter your job title").max(80),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a start date"),
    joinCode: z.string().min(1, "Enter the join code"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFields = z.infer<typeof registerFieldsSchema>;

/**
 * Starting a new organisation. This is the one path that creates an ADMIN, and it is safe only
 * because the administrator it creates owns a brand new organisation with no other members and no
 * data. There is deliberately no field, code or form value that makes someone an administrator of
 * an organisation that already exists: that needs an invitation from an existing administrator.
 */
export const organizationFieldsSchema = z
  .object({
    organizationName: z.string().trim().min(1, "Enter your organisation name").max(120),
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z
      .string()
      .trim()
      .max(254)
      .email("Enter a valid email")
      .transform((value) => value.toLowerCase()),
    password: z.string().min(10, "Password must be at least 10 characters").max(200),
    confirmPassword: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a start date"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type OrganizationFields = z.infer<typeof organizationFieldsSchema>;

/** Parse yyyy-mm-dd as a UTC calendar date so the stored timestamp does not shift with the server timezone. */
export function startDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
