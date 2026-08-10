import { forwardRef } from "react"
import { formatVnd, type InvoiceOutputData } from "@/lib/invoice-text"

interface InvoicePreviewProps {
  invoice: InvoiceOutputData
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

export const InvoicePreview = forwardRef<HTMLElement, InvoicePreviewProps>(function InvoicePreview({ invoice }, ref) {
  return (
    <article ref={ref} className="invoice-preview rounded-xl border bg-white p-5 text-foreground shadow-sm sm:p-7" data-testid="invoice-preview">
      <header className="invoice-header flex items-start justify-between gap-3 border-b-2 border-foreground pb-4">
        <div>
          <h2 className="text-lg font-semibold uppercase tracking-tight sm:text-xl">Hóa đơn / Đơn hàng</h2>
        </div>
        {invoice.invoiceNumber && <span className="invoice-number text-xs font-medium text-muted-foreground">{invoice.invoiceNumber}</span>}
      </header>

      <section className="invoice-customer grid gap-2 border-b py-4 text-xs sm:text-sm">
        <div className="grid grid-cols-[80px_1fr] gap-3"><strong>Khách hàng</strong><span className="text-muted-foreground">{invoice.customerName || "Chưa nhập"}</span></div>
        <div className="grid grid-cols-[80px_1fr] gap-3"><strong>SĐT</strong><span className="text-muted-foreground">{invoice.phone || "Chưa nhập"}</span></div>
        <div className="invoice-address grid grid-cols-[80px_1fr] gap-3"><strong>Địa chỉ</strong><span className="text-muted-foreground">{invoice.address || "Chưa nhập"}</span></div>
      </section>

      <section className="invoice-items py-2" aria-label="Danh sách sản phẩm">
        {invoice.items.length === 0 && <p className="invoice-empty py-3 text-center text-xs text-muted-foreground">Chưa có sản phẩm</p>}
        {invoice.items.map((item, index) => (
          <div className="invoice-item flex justify-between gap-3 border-b py-3 last:border-b-0" key={`${item.productName}-${item.volume}-${item.concentration}-${index}`}>
            <div className="grid gap-1">
              <strong className="text-sm">{item.quantity} × {item.productName || "Sản phẩm"}</strong>
              <span className="text-xs text-muted-foreground">{item.volume || "-"} · {item.concentration || "-"}</span>
            </div>
            <div className="invoice-item-price grid shrink-0 justify-items-end gap-1 text-right">
              <span className="text-xs text-muted-foreground">{formatVnd(item.unitPrice)} × {item.quantity}</span>
              <strong className="text-sm text-primary">{formatVnd(item.lineTotal)}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="invoice-summary grid gap-2 border-t py-4 text-xs">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Tiền hàng</span><strong>{formatVnd(invoice.subtotal)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Thanh toán</span><strong>{(paymentLabels[invoice.paymentMethod] ?? invoice.paymentMethod) || "-"}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Vận chuyển</span><strong>{(shippingLabels[invoice.shippingMethod] ?? invoice.shippingMethod) || "-"}</strong></div>
        {invoice.shippingMethod !== "FREE" && invoice.shippingFee > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Phí ship</span><strong>{formatVnd(invoice.shippingFee)}</strong></div>}
        {invoice.warehouse && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Xuất kho</span><strong>{invoice.warehouse}</strong></div>}
        {invoice.note && <div className="invoice-note flex items-start justify-between gap-3"><span className="text-muted-foreground">Ghi chú</span><strong className="max-w-[65%] text-right font-medium">{invoice.note}</strong></div>}
      </section>

      {invoice.issueInvoice && (
        <section className="invoice-company mb-4 grid gap-1 rounded-lg bg-muted/50 p-3 text-xs">
          <strong>Thông tin xuất hóa đơn</strong>
          <span className="text-muted-foreground">{invoice.companyName}</span>
          <span className="text-muted-foreground">{invoice.invoiceAddress}</span>
          <span className="text-muted-foreground">{invoice.invoiceEmail}</span>
        </section>
      )}

      <footer className="invoice-total flex items-baseline justify-between gap-3 border-t-2 border-foreground pt-4 text-sm"><span>Tổng cộng</span><strong className="text-xl text-primary">{formatVnd(invoice.total)}</strong></footer>
    </article>
  )
})
