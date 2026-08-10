import { prisma } from "@/lib/prisma"
import { getServerEnv } from "@/lib/env"
import { buildSpreadsheetUrl, type GoogleSheetSourceConfig } from "@/server/products/google-sheet-config"

const GOOGLE_SHEET_CONFIG_ID = "default"

export interface GoogleSheetConfigView {
  configured: boolean
  spreadsheetId: string | null
  spreadsheetUrl: string | null
  sheetName: string
  source: "database" | "environment" | "none"
  credentialsConfigured: boolean
  updatedAt: string | null
}

function hasGoogleCredentials(environment: ReturnType<typeof getServerEnv>): boolean {
  return Boolean(environment.GOOGLE_PROJECT_ID && environment.GOOGLE_CLIENT_EMAIL && environment.GOOGLE_PRIVATE_KEY)
}

async function findDatabaseConfig() {
  return prisma.googleSheetConfig.findUnique({
    where: { id: GOOGLE_SHEET_CONFIG_ID },
    select: { spreadsheetId: true, sheetName: true, updatedAt: true },
  })
}

export async function getGoogleSheetSourceConfig(): Promise<GoogleSheetSourceConfig | null> {
  const databaseConfig = await findDatabaseConfig()
  if (databaseConfig) {
    return { spreadsheetId: databaseConfig.spreadsheetId, sheetName: databaseConfig.sheetName }
  }

  const environment = getServerEnv()
  if (!environment.GOOGLE_SHEET_ID) return null
  return { spreadsheetId: environment.GOOGLE_SHEET_ID, sheetName: environment.GOOGLE_SHEET_NAME }
}

export async function getGoogleSheetConfigView(): Promise<GoogleSheetConfigView> {
  const environment = getServerEnv()
  const databaseConfig = await findDatabaseConfig()
  const sourceConfig = databaseConfig
    ? databaseConfig
    : environment.GOOGLE_SHEET_ID
      ? { spreadsheetId: environment.GOOGLE_SHEET_ID, sheetName: environment.GOOGLE_SHEET_NAME }
      : null
  const source = databaseConfig ? "database" : sourceConfig ? "environment" : "none"

  return {
    configured: sourceConfig !== null,
    spreadsheetId: sourceConfig?.spreadsheetId ?? null,
    spreadsheetUrl: sourceConfig ? buildSpreadsheetUrl(sourceConfig.spreadsheetId) : null,
    sheetName: sourceConfig?.sheetName ?? environment.GOOGLE_SHEET_NAME,
    source,
    credentialsConfigured: hasGoogleCredentials(environment),
    updatedAt: databaseConfig?.updatedAt.toISOString() ?? null,
  }
}

export async function saveGoogleSheetConfig(config: GoogleSheetSourceConfig, updatedById: string): Promise<GoogleSheetConfigView> {
  await prisma.googleSheetConfig.upsert({
    where: { id: GOOGLE_SHEET_CONFIG_ID },
    create: {
      id: GOOGLE_SHEET_CONFIG_ID,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      updatedById,
    },
    update: {
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      updatedById,
    },
  })

  return getGoogleSheetConfigView()
}
