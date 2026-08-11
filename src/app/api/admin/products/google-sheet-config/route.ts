import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"
import { parseGoogleSheetConfig } from "@/server/products/google-sheet-config"
import {
  getGoogleSheetConfigView,
  saveGoogleSheetConfig,
} from "@/server/products/google-sheet-config.service"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    assertApiRateLimit(request, "google-sheet-config")
    return successResponse(await getGoogleSheetConfigView())
  } catch (error) {
    return errorResponse(error)
  }
}

async function updateGoogleSheetConfig(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "google-sheet-config-write", 20)
    const user = await requireAdmin()
    const config = parseGoogleSheetConfig(await request.json())
    return successResponse(await saveGoogleSheetConfig(config, user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  return updateGoogleSheetConfig(request)
}

// Some production reverse proxies reject PUT before it reaches Next.js.
// Keep PUT for direct API clients and expose POST for the browser form.
export async function POST(request: NextRequest) {
  return updateGoogleSheetConfig(request)
}
