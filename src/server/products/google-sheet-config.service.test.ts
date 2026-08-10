import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getGoogleSheetConfigView,
  getGoogleSheetSourceConfig,
  saveGoogleSheetConfig,
} from "@/server/products/google-sheet-config.service"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getServerEnv: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { googleSheetConfig: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}))
vi.mock("@/lib/env", () => ({ getServerEnv: mocks.getServerEnv }))

const databaseConfig = {
  spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  sheetName: "Products",
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
}

describe("Google Sheet config service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServerEnv.mockReturnValue({
      GOOGLE_PROJECT_ID: "project-1",
      GOOGLE_CLIENT_EMAIL: "service-account@example.com",
      GOOGLE_PRIVATE_KEY: "private-key",
      GOOGLE_SHEET_ID: undefined,
      GOOGLE_SHEET_NAME: "Products",
    })
    mocks.findUnique.mockResolvedValue(null)
    mocks.upsert.mockResolvedValue(databaseConfig)
  })

  it("prefers a saved database source over legacy environment configuration", async () => {
    mocks.getServerEnv.mockReturnValue({
      GOOGLE_PROJECT_ID: "project-1",
      GOOGLE_CLIENT_EMAIL: "service-account@example.com",
      GOOGLE_PRIVATE_KEY: "private-key",
      GOOGLE_SHEET_ID: "1LegacySheetId1234567890",
      GOOGLE_SHEET_NAME: "Legacy",
    })
    mocks.findUnique.mockResolvedValue(databaseConfig)

    await expect(getGoogleSheetSourceConfig()).resolves.toEqual({
      spreadsheetId: databaseConfig.spreadsheetId,
      sheetName: databaseConfig.sheetName,
    })
    await expect(getGoogleSheetConfigView()).resolves.toMatchObject({
      configured: true,
      source: "database",
      spreadsheetId: databaseConfig.spreadsheetId,
      sheetName: "Products",
      credentialsConfigured: true,
      updatedAt: "2026-08-10T00:00:00.000Z",
    })
  })

  it("falls back to the existing environment source when no database row exists", async () => {
    mocks.getServerEnv.mockReturnValue({
      GOOGLE_PROJECT_ID: undefined,
      GOOGLE_CLIENT_EMAIL: undefined,
      GOOGLE_PRIVATE_KEY: undefined,
      GOOGLE_SHEET_ID: "1LegacySheetId1234567890",
      GOOGLE_SHEET_NAME: "Legacy",
    })

    await expect(getGoogleSheetSourceConfig()).resolves.toEqual({
      spreadsheetId: "1LegacySheetId1234567890",
      sheetName: "Legacy",
    })
    await expect(getGoogleSheetConfigView()).resolves.toMatchObject({
      configured: true,
      source: "environment",
      credentialsConfigured: false,
      sheetName: "Legacy",
    })
  })

  it("upserts the singleton config with the admin who changed it", async () => {
    const config = { spreadsheetId: databaseConfig.spreadsheetId, sheetName: "Catalog" }

    await saveGoogleSheetConfig(config, "admin-1")

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { id: "default", ...config, updatedById: "admin-1" },
      update: { ...config, updatedById: "admin-1" },
    })
  })
})
