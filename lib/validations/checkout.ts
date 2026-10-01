import { z } from "zod"

export const transactionInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(100, "Email must be less than 100 characters."),
  product: z
    .string()
    .trim()
    .min(1, "Product name is required.")
    .max(150, "Product name is too long."),
  amount: z
    .string()
    .trim()
    .min(1, "Denomination / amount is required.")
    .max(100, "Amount label is too long."),
  price: z
    .string()
    .trim()
    .min(1, "Price is required.")
    .max(30, "Price is too long."),
  paymentMethod: z
    .string()
    .trim()
    .min(1, "Payment method is required.")
    .max(100, "Payment method is too long."),
  productId: z
    .string()
    .trim()
    .min(1, "Product ID is required."),
  productCategory: z
    .string()
    .trim()
    .max(100)
    .optional(),
  userId: z
    .string()
    .uuid()
    .nullable()
    .optional(),
  promoCode: z
    .string()
    .trim()
    .max(30, "Promo code is too long.")
    .optional()
    .nullable(),
  turnstileToken: z
    .string()
    .max(2048)
    .optional()
    .nullable(),
  guestData: z
    .record(z.string(), z.any())
    .optional()
    .nullable(),
  date: z
    .string()
    .optional(),
})

export type ValidatedTransactionInput = z.infer<typeof transactionInputSchema>
