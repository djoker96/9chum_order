import Image from "next/image"
import { forwardRef, type ReactNode } from "react"
import invoiceLogo from "@/app/icon.png"
import previewBackground from "@/app/image/bg-preview.png"
import bankTransferQr from "@/app/image/chuyenkhoan.png"
import { formatDiscountLabel, formatVnd, type InvoiceOutputData } from "@/lib/invoice-text"

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

function InvoiceRow({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-5 ${className}`}>
      <span className="shrink-0 text-[#666666]">{label}</span>
      <strong className="max-w-[66%] text-right font-medium text-[#0b0b0b]">{children}</strong>
    </div>
  )
}

export const InvoicePreview = forwardRef<HTMLElement, InvoicePreviewProps>(function InvoicePreview({ invoice }, ref) {
  const isBankTransfer = invoice.paymentMethod === "BANK_TRANSFER"

  return (
    <article
      ref={ref}
      className="invoice-preview relative isolate mx-auto min-h-[926px] w-full max-w-[500px] overflow-hidden bg-white px-5 py-4 font-[Inter,Arial,sans-serif] text-[14px] leading-[1.4] text-[#0b0b0b] shadow-sm"
      data-testid="invoice-preview"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[105px] z-0 w-[480px] max-w-none -translate-x-1/2 opacity-[0.3]"
        height={755}
        priority
        src={previewBackground}
        width={750}
      />

      <header className="relative z-10 flex items-start justify-between gap-3 border-b border-[#0b0b0b] pb-3">
        <div className="flex items-center gap-2.5">
          <Image alt="Logo 9CHUM" className="size-7 shrink-0" height={1200} priority src={invoiceLogo} width={1200} />
          <h2 className="text-[16px] font-bold tracking-[-0.025em]">ĐƠN HÀNG</h2>
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <span className="text-[10px] text-[#999889]">Mã đơn hàng</span>
          <span className="invoice-number text-[14px] font-normal text-[#666666]">{invoice.invoiceNumber || "—"}</span>
        </div>
      </header>

      <section className="invoice-customer relative z-10 grid gap-1.5 border-b border-[#0b0b0b] py-4 text-[14px]" aria-label="Thông tin khách hàng">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><strong>Khách hàng</strong><span className="text-[#666666]">{invoice.customerName || "Chưa nhập"}</span></div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><strong>SĐT</strong><span className="text-[#666666]">{invoice.phone || "Chưa nhập"}</span></div>
        <div className="invoice-address grid grid-cols-[88px_minmax(0,1fr)] gap-2"><strong>Địa chỉ</strong><span className="text-[#666666]">{invoice.address || "Chưa nhập"}</span></div>
      </section>

      <section className="invoice-items relative z-10 py-1.5" aria-label="Danh sách sản phẩm">
        {invoice.items.length === 0 && <p className="invoice-empty py-5 text-center text-[13px] text-[#666666]">Chưa có sản phẩm</p>}
        {invoice.items.map((item, index) => (
          <div className="invoice-item flex justify-between gap-3 border-b border-[#d8d8d8] py-3 last:border-b-0" key={`${item.productName}-${item.volume}-${item.concentration}-${index}`}>
            <div className="min-w-0">
              <strong className="block text-[15px] leading-5">{item.quantity} x {item.productName || "Sản phẩm"}</strong>
              <span className="mt-0.5 block text-[13px] text-[#666666]">{item.volume || "-"} - {item.concentration || "-"}</span>
            </div>
            <div className="invoice-item-price grid shrink-0 justify-items-end gap-0.5 text-right">
              <span className="text-[12px] text-[#666666]">{formatVnd(item.unitPrice)} x {item.quantity}</span>
              <strong className="text-[15px] text-[#fd4512]">{formatVnd(item.lineTotal)}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="invoice-summary relative z-10 grid gap-1.5 border-t border-[#0b0b0b] py-3 text-[14px]">
        <InvoiceRow label="Tiền hàng">{formatVnd(invoice.subtotal)}</InvoiceRow>
        {invoice.discountValue > 0 && <InvoiceRow label={formatDiscountLabel(invoice.discountType, invoice.discountValue)}><span className="text-[#fd4512]">-{formatVnd(invoice.discountAmount)}</span></InvoiceRow>}
        <InvoiceRow label="Thanh toán">{(paymentLabels[invoice.paymentMethod] ?? invoice.paymentMethod) || "-"}</InvoiceRow>
        <InvoiceRow label="Vận chuyển">{(shippingLabels[invoice.shippingMethod] ?? invoice.shippingMethod) || "-"}</InvoiceRow>
        {invoice.shippingMethod !== "FREE" && invoice.shippingFee > 0 && <InvoiceRow label="Phí ship"><span className="text-[#fd4512]">{formatVnd(invoice.shippingFee)}</span></InvoiceRow>}
        {invoice.warehouse && <InvoiceRow label="Xuất kho">{invoice.warehouse}</InvoiceRow>}
        {invoice.note && <InvoiceRow className="invoice-note" label="Ghi chú">{invoice.note}</InvoiceRow>}
      </section>

      <footer className="invoice-total relative z-10 flex items-baseline justify-between gap-3 border-t border-[#0b0b0b] pt-3 text-[15px] font-semibold">
        <span>Tổng cộng</span>
        <strong className="text-[23px] leading-none text-[#fd4512]">{formatVnd(invoice.total)}</strong>
      </footer>

      {invoice.issueInvoice && (
        <section className="invoice-company relative z-10 mt-5 grid gap-1 rounded-md bg-[#fafafa] px-3 py-3 text-[13px]">
          <strong className="mb-0.5 text-[14px]">Thông tin xuất hóa đơn</strong>
          <span className="text-[#666666]">{invoice.companyName || "Chưa nhập"}</span>
          <span className="text-[#666666]">{invoice.invoiceAddress || "Chưa nhập"}</span>
          <span className="text-[#666666]">{invoice.invoiceEmail || "Chưa nhập"}</span>
        </section>
      )}

      {isBankTransfer && (
        <section className="invoice-payment relative z-10 mt-5 grid grid-cols-[minmax(0,1fr)_126px] items-center gap-3 rounded-md bg-[#fafafa] p-3" aria-label="Thông tin chuyển khoản">
          <div className="grid gap-1 text-[12px] text-[#666666]">
            <strong className="mb-1 text-[14px] text-[#0b0b0b]">Quét để thanh toán</strong>
            <span>Ngân hàng Techcombank</span>
            <span>CTCP THUONG MAI DOUBLE K</span>
            <span>1913 5082 2100 11</span>
          </div>
          <Image alt="Mã QR thanh toán Techcombank" className="h-auto w-full rounded-md" height={293} src={bankTransferQr} width={216} />
        </section>
      )}
    </article>
  )
})
