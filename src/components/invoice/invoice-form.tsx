"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { InvoiceActions } from "@/components/invoice/invoice-actions"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { calculateInvoiceTotals, type DiscountType } from "@/lib/money"
import { formatVnd, type InvoiceOutputData } from "@/lib/invoice-text"
import { findProductVariant, getProductConcentrations, getProductNames, getProductVolumes } from "@/lib/product-options"
import { WAREHOUSE_OPTIONS, type InvoiceFormItem, type InvoiceRecord, type PaymentMethod, type ProductVariant, type ShippingMethod, type Warehouse } from "@/types/domain"

const emptyItem = (): InvoiceFormItem => ({ productId: "", name: "", volume: "", concentration: "", quantity: 1 })
const EMPTY_CONCENTRATION_OPTION_VALUE = "__EMPTY_CONCENTRATION__"

interface InvoiceFormProps {
  invoiceId?: string
}

function parseNonNegativeInteger(value: string): number {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return 0
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(parsedValue)))
}

export function InvoiceForm({ invoiceId }: InvoiceFormProps = {}) {
  const previewRef = useRef<HTMLElement>(null)
  const [products, setProducts] = useState<ProductVariant[]>([])
  const [items, setItems] = useState<InvoiceFormItem[]>([emptyItem()])
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [warehouse, setWarehouse] = useState<Warehouse | "">("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER")
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("FREE")
  const [shippingFee, setShippingFee] = useState(0)
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState(0)
  const [note, setNote] = useState("")
  const [issueInvoice, setIssueInvoice] = useState(false)
  const [invoiceInfo, setInvoiceInfo] = useState({ companyName: "", address: "", email: "" })
  const [invoiceNumber, setInvoiceNumber] = useState<string>()
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceRecord | null>(null)
  const [savedPayload, setSavedPayload] = useState<string | null>(null)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadForm(): Promise<void> {
      try {
        const [productsResponse, invoiceResponse] = await Promise.all([
          fetch("/api/products"),
          invoiceId ? fetch(`/api/invoices/${invoiceId}`) : Promise.resolve(null),
        ])
        const productsPayload = await productsResponse.json() as { success: boolean; data?: { products: ProductVariant[] }; error?: { message?: string } }
        if (!productsResponse.ok || !productsPayload.success) throw new Error(productsPayload.error?.message || "Không thể tải sản phẩm.")

        const nextProducts = [...(productsPayload.data?.products ?? [])]
        if (invoiceResponse) {
          const invoicePayload = await invoiceResponse.json() as { success: boolean; data?: { invoice: InvoiceRecord }; error?: { message?: string } }
          if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data?.invoice) throw new Error(invoicePayload.error?.message || "Không thể tải hóa đơn.")
          const invoice = invoicePayload.data.invoice
          for (const item of invoice.items) {
            const productSelectionId = item.productId ?? `invoice-item:${item.id}`
            const snapshot = { id: productSelectionId, externalId: productSelectionId, name: item.productName, volume: item.volume, concentration: item.concentration, price: item.unitPrice, isActive: false }
            const productIndex = nextProducts.findIndex((product) => product.id === productSelectionId)
            if (productIndex === -1) nextProducts.push(snapshot)
            else nextProducts[productIndex] = { ...nextProducts[productIndex], ...snapshot }
          }
          if (isMounted) {
            setItems(invoice.items.map((item) => ({ productId: item.productId ?? `invoice-item:${item.id}`, invoiceItemId: item.productId ? undefined : item.id, name: item.productName, volume: item.volume, concentration: item.concentration, quantity: item.quantity })))
            setCustomerName(invoice.customerName)
            setPhone(invoice.phone)
            setAddress(invoice.address)
            setWarehouse(invoice.warehouse && WAREHOUSE_OPTIONS.includes(invoice.warehouse as Warehouse) ? invoice.warehouse as Warehouse : "")
            setPaymentMethod(invoice.paymentMethod as PaymentMethod)
            setShippingMethod(invoice.shippingMethod as ShippingMethod)
            setShippingFee(invoice.shippingFee)
            setDiscountType(invoice.discountType)
            setDiscountValue(invoice.discountValue)
            setNote(invoice.note ?? "")
            setIssueInvoice(invoice.issueInvoice)
            setInvoiceInfo({ companyName: invoice.companyName ?? "", address: invoice.invoiceAddress ?? "", email: invoice.invoiceEmail ?? "" })
            setInvoiceNumber(invoice.invoiceNumber)
          }
        }
        if (isMounted) setProducts(nextProducts)
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu hóa đơn.")
      } finally {
        if (isMounted) setIsLoadingProducts(false)
      }
    }
    void loadForm()
    return () => { isMounted = false }
  }, [invoiceId])

  const previewInvoice = useMemo<InvoiceOutputData>(() => {
    const lineInputs = items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId)
      const unitPrice = product?.price ?? 0
      return {
        unitPrice,
        quantity: item.quantity,
      }
    })
    const subtotal = lineInputs.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const previewDiscountValue = discountType === "AMOUNT" ? Math.min(discountValue, subtotal) : discountValue
    const totals = calculateInvoiceTotals(lineInputs, shippingFee, shippingMethod, discountType, previewDiscountValue)
    const outputItems = items.map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId)
      return {
        productName: product?.name ?? item.name,
        volume: product?.volume ?? item.volume,
        concentration: product?.concentration ?? item.concentration,
        unitPrice: lineInputs[index]?.unitPrice ?? 0,
        quantity: item.quantity,
        lineTotal: totals.lineTotals[index] ?? 0,
      }
    })
    return {
      invoiceNumber,
      customerName,
      phone,
      address,
      warehouse: warehouse || null,
      paymentMethod,
      shippingMethod,
      shippingFee: totals.shippingFee,
      subtotal: totals.subtotal,
      discountType: totals.discountType,
      discountValue: totals.discountValue,
      discountAmount: totals.discountAmount,
      total: totals.total,
      note,
      issueInvoice,
      companyName: issueInvoice ? invoiceInfo.companyName : null,
      invoiceAddress: issueInvoice ? invoiceInfo.address : null,
      invoiceEmail: issueInvoice ? invoiceInfo.email : null,
      items: outputItems,
    }
  }, [address, customerName, discountType, discountValue, invoiceInfo, invoiceNumber, issueInvoice, items, note, paymentMethod, phone, products, shippingFee, shippingMethod, warehouse])

  const serializedInvoicePayload = JSON.stringify({
    customerName,
    phone,
    address,
    warehouse: warehouse || undefined,
    items: items.map(({ productId, invoiceItemId, quantity }) => invoiceItemId ? { invoiceItemId, quantity } : { productId, quantity }),
    paymentMethod,
    shippingMethod,
    shippingFee,
    discountType,
    discountValue,
    note: note || undefined,
    issueInvoice,
    invoiceInfo: issueInvoice ? invoiceInfo : undefined,
  })

  function updateItem(index: number, changes: Partial<InvoiceFormItem>): void {
    setItems((currentItems) => currentItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
    setCreatedInvoice(null)
  }

  function removeItem(index: number): void {
    setItems((currentItems) => currentItems.length === 1 ? currentItems : currentItems.filter((_, itemIndex) => itemIndex !== index))
    setCreatedInvoice(null)
  }

  async function submitInvoice(): Promise<void> {
    setError(null)
    const invalidItem = items.some((item) => !item.productId)
    if (!customerName.trim() || !phone.trim() || !address.trim() || invalidItem) {
      setError("Vui lòng nhập đủ thông tin khách hàng và chọn sản phẩm hợp lệ.")
      return
    }
    if (issueInvoice && (!invoiceInfo.companyName.trim() || !invoiceInfo.address.trim() || !invoiceInfo.email.trim())) {
      setError("Vui lòng nhập đủ thông tin xuất hóa đơn.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices", {
        method: invoiceId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: serializedInvoicePayload,
      })
      const payload = await response.json() as { success: boolean; data?: { invoice: InvoiceRecord }; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data?.invoice) throw new Error(payload.error?.message || (invoiceId ? "Không thể cập nhật hóa đơn." : "Không thể tạo hóa đơn."))
      setCreatedInvoice(payload.data.invoice)
      setSavedPayload(serializedInvoicePayload)
      setInvoiceNumber(payload.data.invoice.invoiceNumber)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (invoiceId ? "Không thể cập nhật hóa đơn." : "Không thể tạo hóa đơn."))
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm(): void {
    setItems([emptyItem()])
    setCustomerName("")
    setPhone("")
    setAddress("")
    setWarehouse("")
    setPaymentMethod("BANK_TRANSFER")
    setShippingMethod("FREE")
    setShippingFee(0)
    setDiscountType("PERCENTAGE")
    setDiscountValue(0)
    setNote("")
    setIssueInvoice(false)
    setInvoiceInfo({ companyName: "", address: "", email: "" })
    setInvoiceNumber(undefined)
    setCreatedInvoice(null)
    setSavedPayload(null)
    setError(null)
  }

  const isSaved = Boolean(createdInvoice && savedPayload === serializedInvoicePayload)
  const displayedInvoice = invoiceId ? previewInvoice : isSaved ? createdInvoice! : { ...previewInvoice, invoiceNumber: undefined }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="mx-auto mb-6 flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hóa đơn</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{invoiceId ? "Sửa hóa đơn" : "Tạo hóa đơn"}</h1></div>
        <Button variant="outline" nativeButton={false} render={<Link href={invoiceId ? `/invoices/${invoiceId}` : "/invoices"} />}>{invoiceId ? "Chi tiết hóa đơn" : "Lịch sử hóa đơn"}</Button>
      </header>
      <div className="mx-auto grid max-w-7xl items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <Card className="gap-0 shadow-sm">
          <CardHeader className="border-b p-5 sm:p-6">
            <CardTitle className="text-lg">Thông tin đơn hàng</CardTitle>
            <CardDescription>Nhập thông tin khách hàng, sản phẩm và phương thức giao nhận.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="customer-name">Tên khách hàng</Label><Input className="h-9" id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="phone">Số điện thoại</Label><Input className="h-9" id="phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="address">Địa chỉ giao hàng</Label><Textarea id="address" value={address} onChange={(event) => setAddress(event.target.value)} rows={2} /></div>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-base font-semibold">Sản phẩm</h2><p className="text-xs text-muted-foreground">Chọn đúng biến thể để tính giá.</p></div>
              <Button variant="outline" size="sm" type="button" onClick={() => setItems((current) => [...current, emptyItem()])}><PlusIcon /> Thêm sản phẩm</Button>
            </div>
            {isLoadingProducts && <p className="text-sm text-muted-foreground">Đang tải danh mục sản phẩm...</p>}
            {!isLoadingProducts && products.length === 0 && <Alert variant="destructive"><AlertDescription>Chưa có sản phẩm active. Admin cần đồng bộ dữ liệu trước.</AlertDescription></Alert>}
            {items.map((item, index) => {
              const names = getProductNames(products)
              const volumes = getProductVolumes(products, item.name)
              const concentrations = getProductConcentrations(products, item.name, item.volume)
              const concentrationOptions = concentrations.map((concentration) => ({
                value: concentration || EMPTY_CONCENTRATION_OPTION_VALUE,
                label: concentration || "Không áp dụng",
              }))
              const selectedConcentration = item.productId
                ? item.concentration || (concentrations.includes("") ? EMPTY_CONCENTRATION_OPTION_VALUE : null)
                : null
              return (
                <div className="product-row grid items-end gap-3 border-t py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_80px_32px]" key={index}>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1"><Label htmlFor={`product-name-${index}`}>Tên sản phẩm</Label><Select value={item.name || null} onValueChange={(value) => updateItem(index, { name: value ?? "", volume: "", concentration: "", productId: "", invoiceItemId: undefined })}><SelectTrigger className="h-11 w-full text-sm" id={`product-name-${index}`}><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger><SelectContent>{names.map((name) => <SelectItem className="min-h-10 text-sm" key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor={`product-volume-${index}`}>Thể tích</Label><Select value={item.volume || null} onValueChange={(value) => updateItem(index, { volume: value ?? "", concentration: "", productId: "", invoiceItemId: undefined })} disabled={!item.name}><SelectTrigger className="h-11 w-full text-sm" id={`product-volume-${index}`}><SelectValue placeholder="Chọn thể tích" /></SelectTrigger><SelectContent>{volumes.map((volume) => <SelectItem className="min-h-10 text-sm" key={volume} value={volume}>{volume}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor={`product-concentration-${index}`}>Nồng độ</Label><Select value={selectedConcentration} onValueChange={(value) => { const concentration = value === EMPTY_CONCENTRATION_OPTION_VALUE ? "" : value ?? ""; const product = findProductVariant(products, item.name, item.volume, concentration); updateItem(index, { concentration, productId: product?.id ?? "", invoiceItemId: undefined }) }} disabled={!item.volume}><SelectTrigger className="h-11 w-full text-sm" id={`product-concentration-${index}`}><SelectValue placeholder="Chọn nồng độ" /></SelectTrigger><SelectContent>{concentrationOptions.map((option) => <SelectItem className="min-h-10 text-sm" key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor={`product-quantity-${index}`}>Số lượng</Label><Input className="h-9" id={`product-quantity-${index}`} type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></div>
                  <Button className="size-9 p-0" variant="destructive" size="icon" type="button" onClick={() => removeItem(index)} disabled={items.length === 1} aria-label={`Xóa sản phẩm ${index + 1}`}><TrashIcon /></Button>
                </div>
              )
            })}

            <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Thanh toán</legend><RadioGroup className="flex flex-wrap gap-x-5 gap-y-3" value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="BANK_TRANSFER" /><span>Chuyển khoản</span></label><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="COD" /><span>COD</span></label></RadioGroup></fieldset>
            <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Vận chuyển</legend><RadioGroup className="flex flex-wrap gap-x-5 gap-y-3" value={shippingMethod} onValueChange={(value) => { const method = value as ShippingMethod; setShippingMethod(method); if (method === "FREE") setShippingFee(0) }}><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="FREE" /><span>Free ship</span></label><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="DELIVERY_APP" /><span>App giao hàng</span></label><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="COURIER" /><span>Xe / đơn vị vận chuyển</span></label></RadioGroup>{shippingMethod !== "FREE" && <div className="mt-3 max-w-xs space-y-2"><Label htmlFor="shipping-fee">Phí ship</Label><Input className="h-9" id="shipping-fee" type="number" min={0} value={shippingFee} onChange={(event) => setShippingFee(Math.max(0, Number(event.target.value) || 0))} /></div>}</fieldset>
            <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Kho</legend><RadioGroup className="flex flex-wrap gap-x-5 gap-y-3" value={warehouse || "NONE"} onValueChange={(value) => setWarehouse(value === "NONE" ? "" : value as Warehouse)}><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="NONE" /><span>Không chọn</span></label>{WAREHOUSE_OPTIONS.map((option) => <label className="flex items-center gap-2 text-sm" key={option}><RadioGroupItem value={option} /><span>Xuất kho {option}</span></label>)}</RadioGroup></fieldset>
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Giảm giá</legend>
              <RadioGroup
                className="flex flex-wrap gap-x-5 gap-y-3"
                value={discountType}
                onValueChange={(value) => {
                  const nextType = value as DiscountType
                  setDiscountType(nextType)
                  if (nextType === "PERCENTAGE") setDiscountValue((current) => Math.min(current, 100))
                  setCreatedInvoice(null)
                }}
              >
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="PERCENTAGE" /><span>Theo %</span></label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="AMOUNT" /><span>Theo số tiền</span></label>
              </RadioGroup>
              <div className="mt-3 max-w-xs space-y-2">
                <Label htmlFor="discount-value">Mức giảm ({discountType === "PERCENTAGE" ? "%" : "đ"})</Label>
                <Input
                  className="h-9"
                  id="discount-value"
                  type="number"
                  min={0}
                  max={discountType === "PERCENTAGE" ? 100 : undefined}
                  step={1}
                  value={discountValue}
                  onChange={(event) => {
                    const value = parseNonNegativeInteger(event.target.value)
                    setDiscountValue(discountType === "PERCENTAGE" ? Math.min(value, 100) : value)
                    setCreatedInvoice(null)
                  }}
                />
              </div>
            </fieldset>

            <div className="space-y-2"><Label htmlFor="note">Ghi chú</Label><Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} /></div>
            <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Xuất hóa đơn</legend><RadioGroup className="flex flex-wrap gap-x-5 gap-y-3" value={issueInvoice ? "YES" : "NO"} onValueChange={(value) => setIssueInvoice(value === "YES")}><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="NO" /><span>Không</span></label><label className="flex items-center gap-2 text-sm"><RadioGroupItem value="YES" /><span>Có</span></label></RadioGroup>{issueInvoice && <div className="mt-3 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="company-name">Tên đơn vị</Label><Input className="h-9" id="company-name" value={invoiceInfo.companyName} onChange={(event) => setInvoiceInfo((current) => ({ ...current, companyName: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="invoice-address">Địa chỉ xuất hóa đơn</Label><Input className="h-9" id="invoice-address" value={invoiceInfo.address} onChange={(event) => setInvoiceInfo((current) => ({ ...current, address: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="invoice-email">Email xuất hóa đơn</Label><Input className="h-9" id="invoice-email" type="email" value={invoiceInfo.email} onChange={(event) => setInvoiceInfo((current) => ({ ...current, email: event.target.value }))} /></div></div>}</fieldset>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex flex-wrap items-center gap-2"><Button className="h-10" type="button" onClick={() => void submitInvoice()} disabled={isSubmitting || isLoadingProducts}>{isSubmitting ? "Đang lưu..." : invoiceId ? "Lưu thay đổi" : "Tạo hóa đơn"}</Button>{isSaved && !invoiceId && <Button className="h-10" variant="outline" type="button" onClick={resetForm}>Tạo đơn mới</Button>}</div>
          </CardContent>
        </Card>
        <Card className="gap-0 shadow-sm xl:sticky xl:top-6">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-5 pb-4"><CardTitle className="text-lg">Preview</CardTitle>{isSaved && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">{invoiceId ? "Đã cập nhật" : "Đã lưu"}</Badge>}</CardHeader>
          <CardContent className="p-5"><InvoicePreview ref={previewRef} invoice={displayedInvoice} /><InvoiceActions invoice={displayedInvoice} targetRef={previewRef} /><p className="mt-4 text-right text-xs text-muted-foreground">Tổng tạm tính: <strong className="text-sm text-foreground">{formatVnd(displayedInvoice.total)}</strong></p></CardContent>
        </Card>
      </div>
    </main>
  )
}
