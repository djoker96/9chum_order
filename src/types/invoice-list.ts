import type { PaymentMethod, ShippingMethod } from "@/types/domain"

export interface InvoiceListItem {
  id: string
  invoiceNumber: string
  customerName: string
  phone: string
  paymentMethod: PaymentMethod
  shippingMethod: ShippingMethod
  shippingFee: number
  subtotal: number
  total: number
  status: "CONFIRMED" | "CANCELLED"
  createdAt: string
}
