import { z } from "zod"

export const promoValidationInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters.")
    .max(30, "Code cannot exceed 30 characters."),
  productId: z.string().trim().min(1, "Product ID is required."),
  productCategory: z.string().trim().default(""),
  denominationLabel: z.string().trim().min(1, "Denomination is required."),
  email: z.string().trim().email("Please provide a valid email address."),
  userId: z.string().uuid().nullable().optional(),
  deviceId: z.string().trim().max(100).optional(),
})

export const createPromoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters.")
    .max(30, "Code cannot exceed 30 characters.")
    .regex(/^[A-Z0-9\-_]+$/, "Code may only contain uppercase letters, numbers, hyphens, and underscores."),
  description: z.string().max(250).optional().nullable(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().positive("Discount value must be greater than 0."),
  max_discount: z.number().positive().nullable().optional(),
  min_order_amount: z.number().min(0).default(0),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().default(1),
  starts_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  applicable_products: z.array(z.string()).nullable().optional(),
  applicable_categories: z.array(z.string()).nullable().optional(),
  excluded_products: z.array(z.string()).nullable().optional(),
  first_order_only: z.boolean().default(false),
  registered_only: z.boolean().default(false),
  new_user_only: z.boolean().default(false),
})

export type ValidatedPromoCodeInput = z.infer<typeof createPromoCodeSchema>
