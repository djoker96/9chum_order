"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatVnd } from "@/lib/invoice-text"
import { todayInVietnam, type StatisticsBucketResult, type StatisticsPeriod, type StatisticsSummary } from "@/lib/statistics"

interface StaffData {
  id: string
  email: string
  name: string | null
  isActive: boolean
}

interface StatisticsInvoiceData {
  id: string
  invoiceNumber: string
  customerName: string
  phone: string
  total: number
  status: "CONFIRMED" | "CANCELLED"
  createdAt: string
  createdBy: { id: string; name: string | null; email: string }
}

interface StatisticsResponse {
  viewerRole: "ADMIN" | "STAFF"
  selectedStaffId: string | null
  period: { type: StatisticsPeriod; date: string; label: string; start: string; end: string }
  summary: StatisticsSummary
  buckets: StatisticsBucketResult[]
  staff: StaffData[]
  staffSummary: Array<StaffData & StatisticsSummary>
  invoices: StatisticsInvoiceData[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const periodOptions: Array<{ value: StatisticsPeriod; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
]

const selectClassName = "h-10 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

export function StatisticsDashboard() {
  const [period, setPeriod] = useState<StatisticsPeriod>("month")
  const [date, setDate] = useState(() => todayInVietnam())
  const [staffId, setStaffId] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<StatisticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStatistics = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const requestDate = period === "day" || period === "week" ? date : `${date.slice(0, 7)}-01`
      const params = new URLSearchParams({ period, date: requestDate, page: String(page), pageSize: "20" })
      if (staffId) params.set("staffId", staffId)
      if (search) params.set("search", search)
      const response = await fetch(`/api/statistics?${params.toString()}`, { cache: "no-store", signal })
      const payload = await response.json() as { success: boolean; data?: StatisticsResponse; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message || "Không thể tải thống kê.")
      if (signal.aborted) return
      setResult(payload.data)
    } catch (loadError) {
      if (signal.aborted) return
      setResult(null)
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thống kê.")
    } finally {
      if (!signal.aborted) setIsLoading(false)
    }
  }, [date, page, period, search, staffId])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void loadStatistics(controller.signal) }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [loadStatistics])

  function changePeriod(value: StatisticsPeriod): void {
    setPeriod(value)
    setPage(1)
  }

  function changeDate(value: string): void {
    setDate(period === "day" || period === "week" ? value : `${value}-01`)
    setPage(1)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const usesDayInput = period === "day" || period === "week"
  const timeInputValue = usesDayInput ? date : date.slice(0, 7)

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hóa đơn</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Thống kê doanh thu</h1>
            {result && <p className="mt-2 text-sm text-muted-foreground">{result.period.label}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}>Lịch sử hóa đơn</Button>
            <Button nativeButton={false} render={<Link href="/invoices/create" />}>Tạo hóa đơn</Button>
          </div>
        </header>

        <Card className="mb-6 shadow-sm">
          <CardContent className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_220px_260px] lg:items-end">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-xs/relaxed leading-none font-medium select-none">Chu kỳ</legend>
              <div className="flex flex-wrap gap-2">
                {periodOptions.map((option) => (
                  <Button key={option.value} type="button" variant={period === option.value ? "default" : "outline"} aria-pressed={period === option.value} onClick={() => changePeriod(option.value)}>{option.label}</Button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="statistics-date">Thời gian</Label>
              <Input id="statistics-date" className="h-10" type={usesDayInput ? "date" : "month"} value={timeInputValue} onChange={(event) => changeDate(event.target.value)} />
            </div>
            {result?.viewerRole === "ADMIN" && (
              <div className="space-y-2">
                <Label htmlFor="statistics-staff">Nhân viên</Label>
                <select id="statistics-staff" className={selectClassName} value={staffId} onChange={(event) => { setStaffId(event.target.value); setPage(1) }}>
                  <option value="">Tất cả nhân viên</option>
                  {result.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name || staff.email}{staff.isActive ? "" : " (đã ngừng hoạt động)"}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {error && <Alert className="mb-6" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {isLoading && <p className="mb-6 py-6 text-center text-sm text-muted-foreground">Đang tải thống kê...</p>}

        {result && (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-3" aria-label="Tổng quan">
              <SummaryCard label="Tổng doanh thu" value={formatVnd(result.summary.revenue)} />
              <SummaryCard label="Tổng hoa hồng" value={formatVnd(result.summary.commission)} />
              <SummaryCard label="Số hóa đơn xác nhận" value={new Intl.NumberFormat("vi-VN").format(result.summary.invoiceCount)} />
            </section>

            <Card className="shadow-sm">
              <CardHeader className="border-b"><CardTitle className="text-base">Doanh thu và hoa hồng</CardTitle></CardHeader>
              <CardContent className="grid gap-5 p-4 sm:p-6">
                <BarChart ariaLabel="Biểu đồ doanh thu và hoa hồng" buckets={result.buckets} series={[{ key: "revenue", label: "Doanh thu", color: "var(--primary)" }, { key: "commission", label: "Hoa hồng", color: "#10b981" }]} />
                <Table>
                  <TableHeader><TableRow><TableHead>Mốc</TableHead><TableHead className="text-right">Doanh thu</TableHead><TableHead className="text-right">Hoa hồng</TableHead></TableRow></TableHeader>
                  <TableBody>{result.buckets.map((bucket) => <TableRow key={bucket.key}><TableCell>{bucket.label}</TableCell><TableCell className="text-right">{formatVnd(bucket.revenue)}</TableCell><TableCell className="text-right">{formatVnd(bucket.commission)}</TableCell></TableRow>)}</TableBody>
                </Table>
              </CardContent>
            </Card>

            {result.viewerRole === "ADMIN" && !staffId && (
              <Card className="shadow-sm">
                <CardHeader className="border-b"><CardTitle className="text-base">Tổng hợp theo nhân viên</CardTitle></CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <Table>
                    <TableHeader><TableRow><TableHead>Nhân viên</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Doanh thu</TableHead><TableHead className="text-right">Hoa hồng</TableHead><TableHead className="text-right">Hóa đơn</TableHead></TableRow></TableHeader>
                    <TableBody>{result.staffSummary.map((staff) => <TableRow key={staff.id}><TableCell><div className="grid"><span className="font-medium">{staff.name || staff.email}</span><small className="text-muted-foreground">{staff.email}</small></div></TableCell><TableCell><Badge variant="outline" className={staff.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}>{staff.isActive ? "Đang hoạt động" : "Đã ngừng hoạt động"}</Badge></TableCell><TableCell className="text-right">{formatVnd(staff.revenue)}</TableCell><TableCell className="text-right">{formatVnd(staff.commission)}</TableCell><TableCell className="text-right">{staff.invoiceCount}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm">
              <CardHeader className="border-b"><CardTitle className="text-base">Danh sách hóa đơn</CardTitle></CardHeader>
              <CardContent className="p-4 sm:p-6">
                <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
                  <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input className="h-10 pl-9" aria-label="Tìm hóa đơn" placeholder="Tìm mã, tên khách hàng hoặc SĐT" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                  </div>
                  <Button className="h-10" variant="outline" type="submit">Tìm kiếm</Button>
                </form>
                {!isLoading && result.invoices.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hóa đơn phù hợp.</p>}
                {result.invoices.length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>Mã hóa đơn</TableHead><TableHead>Khách hàng</TableHead><TableHead>Người tạo</TableHead><TableHead className="text-right">Tổng tiền</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
                    <TableBody>{result.invoices.map((invoice) => <TableRow key={invoice.id}><TableCell><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></TableCell><TableCell><div className="grid"><span>{invoice.customerName}</span><small className="text-muted-foreground">{invoice.phone}</small></div></TableCell><TableCell>{invoice.createdBy.name || invoice.createdBy.email}</TableCell><TableCell className="text-right font-medium">{formatVnd(invoice.total)}</TableCell><TableCell><Badge variant="outline" className={invoice.status === "CANCELLED" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{invoice.status === "CANCELLED" ? "Đã hủy" : "Đã xác nhận"}</Badge></TableCell><TableCell>{new Date(invoice.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</TableCell></TableRow>)}</TableBody>
                  </Table>
                )}
                {result.pagination.totalPages > 1 && <div className="mt-6 flex items-center justify-center gap-4"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button><span className="text-sm text-muted-foreground">Trang {page} / {result.pagination.totalPages}</span><Button variant="outline" size="sm" disabled={page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Sau</Button></div>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <Card className="shadow-sm"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl font-semibold tracking-tight">{value}</strong></CardContent></Card>
}

function BarChart({ ariaLabel, buckets, series }: {
  ariaLabel: string
  buckets: StatisticsBucketResult[]
  series: Array<{ key: "revenue" | "commission" | "invoiceCount"; label: string; color: string }>
}) {
  const width = Math.max(720, buckets.length * 44)
  const height = 260
  const chartHeight = 190
  const groupWidth = (width - 56) / Math.max(buckets.length, 1)
  const barWidth = Math.max(3, Math.min(18, groupWidth / (series.length + 1)))
  const maxValue = Math.max(1, ...buckets.flatMap((bucket) => series.map(({ key }) => bucket[key])))
  const baseline = chartHeight + 16
  const axisTicks = Array.from({ length: 5 }, (_, index) => Math.round(maxValue * index / 4))

  return (
    <figure className="grid gap-3">
      <div className="flex flex-wrap gap-4" aria-hidden="true">{series.map((item) => <span key={item.key} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2.5 rounded-sm" style={{ background: item.color }} />{item.label}</span>)}</div>
      <div className="overflow-x-auto">
        <svg className="h-auto min-w-full" style={{ width }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          <line x1="44" y1="16" x2="44" y2={baseline} stroke="currentColor" opacity="0.15" />
          {axisTicks.map((tick, index) => {
            const y = baseline - (tick / maxValue) * chartHeight
            return <g key={`${tick}-${index}`}><line x1="44" y1={y} x2={width - 8} y2={y} stroke="currentColor" opacity="0.08" /><text data-axis="y" x="39" y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.65">{formatVnd(tick)}</text></g>
          })}
          <line x1="44" y1={baseline} x2={width - 8} y2={baseline} stroke="currentColor" opacity="0.15" />
          {buckets.map((bucket, bucketIndex) => {
            const x = 48 + bucketIndex * groupWidth
            return <g key={bucket.key}>{series.map((item, seriesIndex) => {
              const value = bucket[item.key]
              const barHeight = value / maxValue * chartHeight
              return <rect key={item.key} x={x + seriesIndex * barWidth} y={baseline - barHeight} width={barWidth * 0.8} height={barHeight} rx="2" fill={item.color}><title>{`${bucket.label} – ${item.label}: ${formatVnd(value)}`}</title></rect>
            })}<text x={x + (series.length * barWidth) / 2} y={baseline + 34} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.65">{bucket.label}</text></g>
          })}
        </svg>
      </div>
    </figure>
  )
}
