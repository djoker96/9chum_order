const REQUIRED_FIELDS = ["id", "product_name", "concentration", "volume", "price", "active"] as const

export interface ProductRow {
  externalId: string
  name: string
  concentration: string
  volume: string
  price: number
  isActive: boolean
}

export interface ProductRecord extends ProductRow {
  id: string
  lastSyncedAt?: Date | null
}

export interface ProductWriteInput extends ProductRow {
  lastSyncedAt: Date
}

export interface ProductSyncRowError {
  row: number
  code: "DUPLICATE_ID" | "INVALID_ROW" | "SYNC_ERROR"
  message: string
}

export interface NormalizedProductRows {
  rows: ProductRow[]
  errors: ProductSyncRowError[]
}

export interface ProductRepository {
  findByExternalIds(externalIds: string[]): Promise<ProductRecord[]>
  create(input: ProductWriteInput): Promise<ProductRecord>
  update(id: string, input: ProductWriteInput): Promise<ProductRecord>
}

export interface ProductSyncSummary {
  created: number
  updated: number
  unchanged: number
  skipped: number
  errors: number
  details: ProductSyncRowError[]
}

function normalizedKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_")
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null

  const raw = readString(value)
  if (!raw || !/^\d(?:[\d\s.,]*\d)?\s*(?:đ|₫|vnd)?$/i.test(raw)) return null
  const digitsOnly = raw.replace(/[^0-9]/g, "")
  if (!digitsOnly) return null
  const price = Number(digitsOnly)
  return Number.isSafeInteger(price) && price >= 0 ? price : null
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1

  const normalized = readString(value).toLowerCase()
  if (["true", "1", "yes", "y", "có", "co"].includes(normalized)) return true
  if (["false", "0", "no", "n", "không", "khong"].includes(normalized)) return false
  return null
}

function normalizeRow(row: Record<string, unknown>, rowNumber: number): { row: ProductRow } | { error: ProductSyncRowError } {
  const values = Object.entries(row).reduce<Record<string, unknown>>(
    (result, [key, value]) => ({ ...result, [normalizedKey(key)]: value }),
    {},
  )
  const externalId = readString(values.id)
  const name = readString(values.product_name)
  const concentration = readString(values.concentration)
  const volume = readString(values.volume)
  const price = parsePrice(values.price)
  const isActive = parseBoolean(values.active)
  const missingField = REQUIRED_FIELDS.find((field) => readString(values[field]) === "")

  if (missingField || price === null || isActive === null) {
    return {
      error: {
        row: rowNumber,
        code: "INVALID_ROW",
        message: `Dòng ${rowNumber} thiếu hoặc sai dữ liệu sản phẩm.`,
      },
    }
  }

  return { row: { externalId, name, concentration, volume, price, isActive } }
}

export function normalizeProductRows(rawRows: Record<string, unknown>[]): NormalizedProductRows {
  const seenIds = new Set<string>()
  const rows: ProductRow[] = []
  const errors: ProductSyncRowError[] = []

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2
    const normalized = normalizeRow(rawRow, rowNumber)
    if ("error" in normalized) {
      errors.push(normalized.error)
      return
    }

    if (seenIds.has(normalized.row.externalId)) {
      errors.push({
        row: rowNumber,
        code: "DUPLICATE_ID",
        message: `External ID bị trùng: ${normalized.row.externalId}.`,
      })
      return
    }

    seenIds.add(normalized.row.externalId)
    rows.push(normalized.row)
  })

  return { rows, errors }
}

function hasChanged(existing: ProductRecord, incoming: ProductRow): boolean {
  return existing.name !== incoming.name
    || existing.concentration !== incoming.concentration
    || existing.volume !== incoming.volume
    || existing.price !== incoming.price
    || existing.isActive !== incoming.isActive
}

export async function syncProductRows(
  rows: ProductRow[],
  repository: ProductRepository,
  now = new Date(),
): Promise<ProductSyncSummary> {
  const initialSummary: ProductSyncSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: 0,
    details: [],
  }

  if (rows.length === 0) return initialSummary

  const existingProducts = await repository.findByExternalIds([...new Set(rows.map((row) => row.externalId))])
  const existingByExternalId = new Map(existingProducts.map((product) => [product.externalId, product]))
  const writeBatchSize = 25
  let summary = initialSummary

  for (let start = 0; start < rows.length; start += writeBatchSize) {
    const batch = rows.slice(start, start + writeBatchSize)
    const outcomes = await Promise.all(batch.map(async (row, batchIndex) => {
      const input: ProductWriteInput = { ...row, lastSyncedAt: now }
      try {
        const existing = existingByExternalId.get(row.externalId)
        if (!existing) {
          await repository.create(input)
          return { kind: "created" as const }
        }
        if (hasChanged(existing, row)) {
          await repository.update(existing.id, input)
          return { kind: "updated" as const }
        }
        return { kind: "unchanged" as const }
      } catch {
        return {
          kind: "error" as const,
          detail: {
            row: start + batchIndex + 2,
            code: "SYNC_ERROR" as const,
            message: `Không thể lưu sản phẩm ${row.externalId}.`,
          },
        }
      }
    }))

    summary = outcomes.reduce<ProductSyncSummary>((result, outcome) => {
      if (outcome.kind === "created") return { ...result, created: result.created + 1 }
      if (outcome.kind === "updated") return { ...result, updated: result.updated + 1 }
      if (outcome.kind === "unchanged") return { ...result, unchanged: result.unchanged + 1 }
      return { ...result, errors: result.errors + 1, details: [...result.details, outcome.detail] }
    }, summary)
  }

  return summary
}
