import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"

const buckets = [
  { key: "2026-08-01", label: "01/08", revenue: 1_000_000, commission: 100_000, invoiceCount: 1 },
  { key: "2026-08-02", label: "02/08", revenue: 0, commission: 0, invoiceCount: 0 },
]

const statisticsResponse = {
  success: true,
  data: {
    viewerRole: "ADMIN",
    selectedStaffId: null,
    period: { type: "month", date: "2026-08-01", label: "Tháng 08/2026", start: "2026-07-31T17:00:00.000Z", end: "2026-08-31T17:00:00.000Z" },
    summary: { revenue: 1_000_000, commission: 100_000, invoiceCount: 1 },
    buckets,
    staff: [
      { id: "staff-1", email: "staff@example.com", name: "Nhân viên A", isActive: true },
      { id: "staff-2", email: "old@example.com", name: "Nhân viên cũ", isActive: false },
    ],
    staffSummary: [
      { id: "staff-1", email: "staff@example.com", name: "Nhân viên A", isActive: true, revenue: 1_000_000, commission: 100_000, invoiceCount: 1 },
      { id: "staff-2", email: "old@example.com", name: "Nhân viên cũ", isActive: false, revenue: 0, commission: 0, invoiceCount: 0 },
    ],
    invoices: [{
      id: "invoice-1",
      invoiceNumber: "HD-1",
      customerName: "Khách hàng A",
      phone: "0900000000",
      total: 1_000_000,
      status: "CONFIRMED",
      createdAt: "2026-08-01T03:00:00.000Z",
      createdBy: { id: "staff-1", name: "Nhân viên A", email: "staff@example.com" },
    }],
    pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
  },
}

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
}

async function flushLoad(): Promise<void> {
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
}

describe("StatisticsDashboard", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-20T17:30:00.000Z"))
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(response(statisticsResponse))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("defaults to the current month in Vietnam and renders the report", async () => {
    render(<StatisticsDashboard />)
    await flushLoad()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("period=month&date=2026-08-01"), expect.objectContaining({ cache: "no-store" }))
    expect(screen.getByLabelText("Thời gian")).toHaveAttribute("type", "month")
    expect(screen.getByLabelText("Thời gian")).toHaveValue("2026-08")
    expect(screen.getByRole("group", { name: "Chu kỳ" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Thống kê doanh thu" })).toBeInTheDocument()
    expect(screen.getByText("Tháng 08/2026")).toBeInTheDocument()
    expect(screen.getByText("HD-1")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Biểu đồ doanh thu và hoa hồng" })).toBeInTheDocument()
  })

  it("switches periods and uses native date or month inputs", async () => {
    render(<StatisticsDashboard />)
    await flushLoad()

    fireEvent.click(screen.getByRole("button", { name: "Tuần" }))
    await flushLoad()
    expect(screen.getByLabelText("Thời gian")).toHaveAttribute("type", "date")
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("period=week&date=2026-08-21"), expect.objectContaining({ cache: "no-store" }))
    fireEvent.change(screen.getByLabelText("Thời gian"), { target: { value: "2026-08-15" } })
    await flushLoad()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("period=week&date=2026-08-15"), expect.objectContaining({ cache: "no-store" }))

    fireEvent.click(screen.getByRole("button", { name: "Quý" }))
    await flushLoad()
    expect(screen.getByLabelText("Thời gian")).toHaveAttribute("type", "month")
    fireEvent.change(screen.getByLabelText("Thời gian"), { target: { value: "2026-05" } })
    await flushLoad()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("period=quarter&date=2026-05-01"), expect.objectContaining({ cache: "no-store" }))
  })

  it("filters staff, searches invoices and paginates", async () => {
    render(<StatisticsDashboard />)
    await flushLoad()

    fireEvent.change(screen.getByLabelText("Nhân viên"), { target: { value: "staff-2" } })
    await flushLoad()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("staffId=staff-2"), expect.objectContaining({ cache: "no-store" }))

    fireEvent.change(screen.getByLabelText("Tìm hóa đơn"), { target: { value: "HD-1" } })
    fireEvent.submit(screen.getByRole("button", { name: "Tìm kiếm" }).closest("form")!)
    await flushLoad()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("search=HD-1"), expect.objectContaining({ cache: "no-store" }))

    fireEvent.click(screen.getByRole("button", { name: "Sau" }))
    await flushLoad()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("page=2"), expect.objectContaining({ cache: "no-store" }))
  })

  it("renders empty and error states", async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        ...statisticsResponse,
        data: { ...statisticsResponse.data, summary: { revenue: 0, commission: 0, invoiceCount: 0 }, buckets: buckets.map((bucket) => ({ ...bucket, revenue: 0, commission: 0, invoiceCount: 0 })), invoices: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      }))
      .mockResolvedValueOnce(response({ success: false, error: { message: "Không thể tải thống kê." } }, false))

    render(<StatisticsDashboard />)
    await flushLoad()
    expect(screen.getByText("Chưa có hóa đơn phù hợp.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ngày" }))
    await flushLoad()
    expect(screen.getByText("Không thể tải thống kê.")).toBeInTheDocument()
    expect(screen.queryByText("Doanh thu và hoa hồng")).not.toBeInTheDocument()
  })

  it("does not let an older response overwrite a newer period", async () => {
    let resolveFirst: (value: Response) => void = () => undefined
    const firstResponse = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const newerResponse = {
      ...statisticsResponse,
      data: {
        ...statisticsResponse.data,
        period: { ...statisticsResponse.data.period, type: "day", label: "Ngày 21/08/2026" },
        summary: { revenue: 2_000_000, commission: 200_000, invoiceCount: 2 },
      },
    }
    fetchMock.mockReset()
    fetchMock.mockReturnValueOnce(firstResponse).mockResolvedValueOnce(response(newerResponse))

    render(<StatisticsDashboard />)
    await flushLoad()
    fireEvent.click(screen.getByRole("button", { name: "Ngày" }))
    await flushLoad()
    expect(screen.getByText("Ngày 21/08/2026")).toBeInTheDocument()

    await act(async () => { resolveFirst(response(statisticsResponse)); await Promise.resolve() })

    expect(screen.getByText("Ngày 21/08/2026")).toBeInTheDocument()
    expect(screen.queryByText("Tháng 08/2026")).not.toBeInTheDocument()
  })
})
