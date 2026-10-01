import { z } from "zod"

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be less than 100 characters."),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(100, "Email must be less than 100 characters."),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required.")
    .max(150, "Subject must be less than 150 characters."),
  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters.")
    .max(5000, "Message is too long."),
  turnstileToken: z.string().optional().nullable(),
})

export type ValidatedContactInput = z.infer<typeof contactFormSchema>
