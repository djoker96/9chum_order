import type { DiscountType } from "@/lib/money"

export interface InvoiceOutputItem {
  productName: string
  volume: string
  concentration: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface InvoiceOutputData {
  invoiceNumber?: string
  customerName: string
  phone: string
  address: string
  warehouse?: string | null
  paymentMethod: string
  shippingMethod: string
  shippingFee: number
  subtotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  total: number
  note?: string | null
  issueInvoice: boolean
  companyName?: string | null
  invoiceAddress?: string | null
  invoiceEmail?: string | null
  items: InvoiceOutputItem[]
}

const paymentLabels: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  COD: "COD",
}

const shippingLabels: Record<string, string> = {
  FREE: "Free ship",
  DELIVERY_APP: "Ship qua app giao hàng",
  COURIER: "Ship qua xe / đơn vị vận chuyển",
}

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`
}

export function formatDiscountValue(discountType: DiscountType, discountValue: number): string {
  return discountType === "PERCENTAGE" ? `${discountValue}%` : formatVnd(discountValue)
}

export function formatDiscountLabel(discountType: DiscountType, discountValue: number): string {
  return `Giảm giá (${formatDiscountValue(discountType, discountValue)})`
}

export function formatDiscountLine(invoice: Pick<InvoiceOutputData, "discountType" | "discountValue" | "discountAmount">): string {
  const methodLabel = invoice.discountType === "PERCENTAGE" ? "theo %" : "theo số tiền"
  return `Giảm giá (${methodLabel}): ${formatDiscountValue(invoice.discountType, invoice.discountValue)} (-${formatVnd(invoice.discountAmount)})`
}

function formatConcentration(value: string): string {
  return value.trim().replace(/\s*%$/, " độ")
}

export function buildInvoicePlainText(invoice: InvoiceOutputData): string {
  const itemLines = invoice.items.map((item) =>
    `- ${item.quantity} ${item.productName} - ${item.volume} - ${formatConcentration(item.concentration)}: ${formatVnd(item.unitPrice)} × ${item.quantity} = ${formatVnd(item.lineTotal)}`,
  )
  const shippingLines = invoice.shippingMethod === "FREE"
    ? [`Vận chuyển: ${shippingLabels[invoice.shippingMethod]}`]
    : [`Vận chuyển: ${shippingLabels[invoice.shippingMethod] ?? invoice.shippingMethod}`, `Phí ship: ${formatVnd(invoice.shippingFee)}`]
  const companyLines = invoice.issueInvoice
    ? ["", "Thông tin xuất hóa đơn:", `Tên đơn vị: ${invoice.companyName ?? ""}`, `Địa chỉ: ${invoice.invoiceAddress ?? ""}`, `Email: ${invoice.invoiceEmail ?? ""}`]
    : []

  return [
    ...(invoice.invoiceNumber ? [`Mã hóa đơn: ${invoice.invoiceNumber}`] : []),
    `Khách hàng: ${invoice.customerName}`,
    `SĐT: ${invoice.phone}`,
    `Địa chỉ: ${invoice.address}`,
    ...(invoice.warehouse?.trim() ? [`Kho: ${invoice.warehouse.trim()}`] : []),
    "--------------------",
    ...itemLines,
    "--------------------",
    `Tiền hàng: ${formatVnd(invoice.subtotal)}`,
    ...(invoice.discountValue > 0 ? [formatDiscountLine(invoice)] : []),
    `Thanh toán: ${paymentLabels[invoice.paymentMethod] ?? invoice.paymentMethod}`,
    ...shippingLines,
    ...(invoice.note ? [`Ghi chú: ${invoice.note}`] : []),
    ...companyLines,
    "--------------------",
    `Tổng cộng: ${formatVnd(invoice.total)}`,
  ].join("\n")
}

export function safeInvoiceFileName(customerName: string, extension: "png" | "pdf"): string {
  const normalized = customerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `hoa-don-${normalized || "khach-hang"}.${extension}`
}
