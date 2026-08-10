"use client"

import { RefObject, useState } from "react"
import { CopyIcon, FilePdfIcon, ImageIcon } from "@phosphor-icons/react"
import { buildInvoicePlainText, safeInvoiceFileName, type InvoiceOutputData } from "@/lib/invoice-text"
import { Button } from "@/components/ui/button"

interface InvoiceActionsProps {
  invoice: InvoiceOutputData
  targetRef: RefObject<HTMLElement | null>
}

export function InvoiceActions({ invoice, targetRef }: InvoiceActionsProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  async function copyInvoice(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildInvoicePlainText(invoice))
      setMessage("Đã copy nội dung hóa đơn.")
    } catch {
      setMessage("Không thể copy. Hãy kiểm tra quyền clipboard của trình duyệt.")
    }
  }

  async function exportPng(): Promise<void> {
    if (!targetRef.current) return
    setIsExporting(true)
    try {
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(targetRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 })
      downloadDataUrl(dataUrl, safeInvoiceFileName(invoice.customerName, "png"))
      setMessage("Đã xuất PNG.")
    } catch {
      setMessage("Không thể xuất PNG.")
    } finally {
      setIsExporting(false)
    }
  }

  async function exportPdf(): Promise<void> {
    if (!targetRef.current) return
    setIsExporting(true)
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")])
      const dataUrl = await toPng(targetRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 })
      const image = await loadImage(dataUrl)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageHeight = (image.height / image.width) * pageWidth
      let remainingHeight = imageHeight
      let yPosition = 0

      pdf.addImage(dataUrl, "PNG", 0, yPosition, pageWidth, imageHeight)
      remainingHeight -= pageHeight
      while (remainingHeight > 0) {
        yPosition -= pageHeight
        pdf.addPage()
        pdf.addImage(dataUrl, "PNG", 0, yPosition, pageWidth, imageHeight)
        remainingHeight -= pageHeight
      }
      pdf.save(safeInvoiceFileName(invoice.customerName, "pdf"))
      setMessage("Đã xuất PDF.")
    } catch {
      setMessage("Không thể xuất PDF.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="invoice-actions mt-4 flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" type="button" onClick={copyInvoice}><CopyIcon /> Copy</Button>
      <Button variant="outline" size="sm" type="button" onClick={exportPng} disabled={isExporting}><ImageIcon /> PNG</Button>
      <Button variant="outline" size="sm" type="button" onClick={exportPdf} disabled={isExporting}><FilePdfIcon /> PDF</Button>
      {message && <span className="text-xs text-emerald-700" role="status">{message}</span>}
    </div>
  )
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a")
  link.download = fileName
  link.href = dataUrl
  link.click()
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}
