import { z } from "zod"
import { WAREHOUSE_OPTIONS } from "@/types/domain"

const invoiceInfoSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  email: z.string().trim().email().max(320),
})

const warehouseSchema = z.enum(WAREHOUSE_OPTIONS).optional()

export const createInvoiceSchema = z
  .object({
    customerName: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(30),
    address: z.string().trim().min(1).max(500),
    warehouse: warehouseSchema,
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1).max(100),
          quantity: z.number().int().min(1).max(10_000),
        }),
      )
      .min(1)
      .max(100),
    paymentMethod: z.enum(["BANK_TRANSFER", "COD"]),
    shippingMethod: z.enum(["FREE", "DELIVERY_APP", "COURIER"]),
    shippingFee: z.number().int().min(0).max(100_000_000).default(0),
    note: z.string().trim().max(2_000).optional(),
    issueInvoice: z.boolean().default(false),
    invoiceInfo: invoiceInfoSchema.optional(),
  })
  .superRefine((data, context) => {
    if (data.issueInvoice && !data.invoiceInfo) {
      context.addIssue({
        code: "custom",
        path: ["invoiceInfo"],
        message: "Thông tin xuất hóa đơn là bắt buộc.",
      })
    }
  })
  .transform((data) => ({
    ...data,
    invoiceInfo: data.issueInvoice ? data.invoiceInfo : undefined,
    shippingFee: data.shippingMethod === "FREE" ? 0 : data.shippingFee,
  }))

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
