import { z } from "zod"
import { WAREHOUSE_OPTIONS } from "@/types/domain"

const invoiceInfoSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  email: z.string().trim().email().max(320),
})

const warehouseSchema = z.enum(WAREHOUSE_OPTIONS).optional()
const discountValueSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((value) => Number.isSafeInteger(value), "Giá trị giảm phải là số nguyên hợp lệ.")

const invoiceShape = {
  customerName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(30),
  address: z.string().trim().min(1).max(500),
  warehouse: warehouseSchema,
  paymentMethod: z.enum(["BANK_TRANSFER", "COD"]),
  shippingMethod: z.enum(["FREE", "DELIVERY_APP", "COURIER"]),
  shippingFee: z.number().int().min(0).max(100_000_000).default(0),
  discountType: z.enum(["PERCENTAGE", "AMOUNT"]).default("PERCENTAGE"),
  discountValue: discountValueSchema.default(0),
  note: z.string().trim().max(2_000).optional(),
  issueInvoice: z.boolean().default(false),
  invoiceInfo: invoiceInfoSchema.optional(),
}

const createInvoiceItemsSchema = z.array(z.object({
  productId: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(10_000),
})).min(1).max(100)

const updateInvoiceItemsSchema = z.array(z.object({
  productId: z.string().trim().min(1).max(100).optional(),
  invoiceItemId: z.string().trim().min(1).max(100).optional(),
  quantity: z.number().int().min(1).max(10_000),
}).refine((item) => Boolean(item.productId) !== Boolean(item.invoiceItemId), {
  message: "Mỗi dòng hóa đơn phải tham chiếu một sản phẩm hoặc dòng hàng cũ.",
})).min(1).max(100)

function invoiceSchema<T extends z.ZodType>(items: T) {
  return z.object({ ...invoiceShape, items })
    .superRefine((data, context) => {
      if (data.issueInvoice && !data.invoiceInfo) {
        context.addIssue({
          code: "custom",
          path: ["invoiceInfo"],
          message: "Thông tin xuất hóa đơn là bắt buộc.",
        })
      }
      if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
        context.addIssue({
          code: "too_big",
          maximum: 100,
          origin: "number",
          inclusive: true,
          path: ["discountValue"],
          message: "Phần trăm giảm giá phải từ 0 đến 100%.",
        })
      }
    })
    .transform((data) => ({
      ...data,
      invoiceInfo: data.issueInvoice ? data.invoiceInfo : undefined,
      shippingFee: data.shippingMethod === "FREE" ? 0 : data.shippingFee,
    }))
}

export const createInvoiceSchema = invoiceSchema(createInvoiceItemsSchema)
export const updateInvoiceSchema = invoiceSchema(updateInvoiceItemsSchema)

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
