import type { InvoiceOutputData, InvoiceOutputItem } from "@/lib/invoice-text"

export type { DiscountType } from "@/lib/money"

export type PaymentMethod = "BANK_TRANSFER" | "COD"
export type ShippingMethod = "FREE" | "DELIVERY_APP" | "COURIER"
export const WAREHOUSE_OPTIONS = ["L7-21", "L7-22"] as const
export type Warehouse = (typeof WAREHOUSE_OPTIONS)[number]

export interface ProductVariant {
  id: string
  externalId: string
  name: string
  volume: string
  concentration: string
  price: number
  isActive: boolean
  sourceOrder?: number | null
}

export interface InvoiceRecord extends Omit<InvoiceOutputData, "items"> {
  id: string
  invoiceNumber: string
  status: "CONFIRMED" | "CANCELLED"
  createdAt: string
  updatedAt?: string
  items: Array<InvoiceOutputItem & { id: string; productId: string | null }>
}

export interface InvoiceFormItem {
  productSelectionId: string
  invoiceItemId?: string
  name: string
  volume: string
  concentration: string
  quantity: number
}
