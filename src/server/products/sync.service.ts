import { prisma } from "@/lib/prisma"
import { productRepository } from "@/server/products/product.repository"
import { normalizeProductRows, syncProductRows } from "@/server/products/product-sync"
import { readGoogleSheetProductRows } from "@/server/products/google-sheets"
import { getGoogleSheetSourceConfig } from "@/server/products/google-sheet-config.service"
import { AppError } from "@/server/http/api"
import { Prisma, type SyncSource } from "@prisma/client"

async function runProductSync(
  initialLogId: string,
  source: SyncSource,
  loadRows: () => Promise<Record<string, unknown>[]>,
) {
  try {
    const rawRows = await loadRows()
    const normalized = normalizeProductRows(rawRows)
    const syncedAt = new Date()
    const summary = await syncProductRows(normalized.rows, productRepository, syncedAt)
    const canReconcileMissing = source === "GOOGLE_SHEETS"
      && normalized.rows.length > 0
      && normalized.errors.length === 0
      && summary.errors === 0
    const deactivated = canReconcileMissing
      ? await productRepository.deactivateMissingExternalIds(normalized.rows.map((row) => row.externalId), syncedAt)
      : 0
    const details = [...normalized.errors, ...summary.details]
    const status = details.length === 0 ? "SUCCESS" : "PARTIAL"
    const completedAt = new Date()
    const log = await prisma.productSyncLog.update({
      where: { id: initialLogId },
      data: {
        status,
        createdCount: summary.created,
        updatedCount: summary.updated,
        unchangedCount: summary.unchanged,
        deactivatedCount: deactivated,
        skippedCount: normalized.errors.length,
        errorCount: details.length,
        detailJson: details.length > 0 ? (details as unknown as Prisma.InputJsonValue) : undefined,
        completedAt,
      },
    })

    return {
      syncLogId: log.id,
      created: summary.created,
      updated: summary.updated,
      unchanged: summary.unchanged,
      deactivated,
      skipped: normalized.errors.length,
      errors: details.length,
      completedAt,
      details,
    }
  } catch (error) {
    await prisma.productSyncLog.update({
      where: { id: initialLogId },
      data: {
        status: "FAILED",
        errorCount: 1,
        errorMessage: "Product sync failed",
        completedAt: new Date(),
      },
    })
    throw error
  }
}

async function createInitialSyncLog(createdById: string, source: SyncSource): Promise<string> {
  const log = await prisma.productSyncLog.create({
    data: { source, status: "FAILED", startedAt: new Date(), createdById },
    select: { id: true },
  })
  return log.id
}

export async function syncProductsFromRows(
  rawRows: Record<string, unknown>[],
  createdById: string,
  source: SyncSource,
) {
  const initialLogId = await createInitialSyncLog(createdById, source)
  return runProductSync(initialLogId, source, async () => rawRows)
}

export async function syncProductsFromGoogleSheets(createdById: string) {
  const source = "GOOGLE_SHEETS" as const
  const initialLogId = await createInitialSyncLog(createdById, source)
  return runProductSync(initialLogId, source, async () => {
    const config = await getGoogleSheetSourceConfig()
    if (!config) throw new AppError(503, "GOOGLE_SHEET_ACCESS_DENIED", "Google Sheets chưa được cấu hình.")
    return readGoogleSheetProductRows(config)
  })
}
