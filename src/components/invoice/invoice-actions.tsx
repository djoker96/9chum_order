"use client"

import { RefObject, useState } from "react"
import { CopyIcon, FilePdfIcon, ImageIcon } from "@phosphor-icons/react"
import { buildInvoicePlainText, safeInvoiceFileName, type InvoiceOutputData } from "@/lib/invoice-text"
import { Button } from "@/components/ui/button"
import { calculatePdfPageLayout, cropInvoiceImage, getInvoiceCaptureOptions, waitForInvoicePreviewReady } from "@/components/invoice/invoice-export"

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
      const { toBlob } = await import("html-to-image")
      const blob = await captureInvoiceBlob(targetRef.current, toBlob)
      downloadBlob(blob, safeInvoiceFileName(invoice.customerName, "png"))
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
      const dataUrl = await captureInvoicePng(targetRef.current, toPng)
      const image = await loadImage(dataUrl)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const layout = calculatePdfPageLayout(image.width, image.height, pageWidth, pageHeight)

      layout.pages.forEach((page, index) => {
        if (index > 0) pdf.addPage()
        const pageDataUrl = layout.pages.length === 1 ? dataUrl : cropInvoiceImage(image, page)
        pdf.addImage(pageDataUrl, "PNG", page.x, page.y, page.width, page.height)
      })
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

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = fileName
  link.href = url
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function captureInvoiceBlob(
  node: HTMLElement,
  toBlob: (node: HTMLElement, options: ReturnType<typeof getInvoiceCaptureOptions>) => Promise<Blob | null>,
): Promise<Blob> {
  await waitForInvoicePreviewReady(node)
  const blob = await toBlob(node, getInvoiceCaptureOptions(node))
  if (!blob) throw new Error("Invoice export did not produce a PNG blob.")
  return blob
}

async function captureInvoicePng(
  node: HTMLElement,
  toPng: (node: HTMLElement, options: ReturnType<typeof getInvoiceCaptureOptions>) => Promise<string>,
): Promise<string> {
  await waitForInvoicePreviewReady(node)
  return toPng(node, getInvoiceCaptureOptions(node))
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}
