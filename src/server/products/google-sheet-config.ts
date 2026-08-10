import { z } from "zod"

const SPREADSHEET_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/
const TAB_NAME_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/

export interface GoogleSheetSourceConfig {
  spreadsheetId: string
  sheetName: string
}

function assertSpreadsheetId(value: string): string {
  if (!SPREADSHEET_ID_PATTERN.test(value)) {
    throw new Error("Spreadsheet ID không hợp lệ.")
  }
  return value
}

export function parseSpreadsheetId(value: string): string {
  const rawValue = value.trim()
  if (!rawValue) throw new Error("Spreadsheet ID không được để trống.")

  if (!rawValue.startsWith("http://") && !rawValue.startsWith("https://")) {
    return assertSpreadsheetId(rawValue)
  }

  let url: URL
  try {
    url = new URL(rawValue)
  } catch {
    throw new Error("URL Google Sheet không hợp lệ.")
  }

  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("Chỉ chấp nhận URL Google Sheets.")
  }

  const match = /^\/spreadsheets\/d\/([^/]+)(?:\/|$)/.exec(url.pathname)
  if (!match) throw new Error("URL Google Sheet không có Spreadsheet ID.")
  return assertSpreadsheetId(match[1])
}

const googleSheetConfigInputSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1, "URL Google Sheet là bắt buộc.").max(500),
  sheetName: z.string().trim().min(1, "Tên tab là bắt buộc.").max(100, "Tên tab quá dài."),
}).superRefine((input, context) => {
  try {
    parseSpreadsheetId(input.spreadsheetUrl)
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: ["spreadsheetUrl"],
      message: error instanceof Error ? error.message : "URL Google Sheet không hợp lệ.",
    })
  }

  if (TAB_NAME_CONTROL_CHARACTERS.test(input.sheetName)) {
    context.addIssue({
      code: "custom",
      path: ["sheetName"],
      message: "Tên tab không được chứa ký tự điều khiển.",
    })
  }
})

export function parseGoogleSheetConfig(input: unknown): GoogleSheetSourceConfig {
  const parsed = googleSheetConfigInputSchema.parse(input)
  return {
    spreadsheetId: parseSpreadsheetId(parsed.spreadsheetUrl),
    sheetName: parsed.sheetName,
  }
}

export function buildSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${assertSpreadsheetId(spreadsheetId)}/edit`
}
