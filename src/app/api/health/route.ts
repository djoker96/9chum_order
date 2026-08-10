import { getDatabaseReadiness } from "@/app/api/health/readiness"

const noStoreHeaders = { "Cache-Control": "no-store" }

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  if (await getDatabaseReadiness()) {
    return Response.json(
      { success: true, data: { status: "ready" } },
      { status: 200, headers: noStoreHeaders },
    )
  }

  return Response.json(
    {
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Dịch vụ chưa sẵn sàng.",
      },
    },
    { status: 503, headers: noStoreHeaders },
  )
}
