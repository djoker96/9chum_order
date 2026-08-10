import { NextResponse } from "next/server"
import { ZodError } from "zod"

const noStoreHeaders = { "Cache-Control": "no-store" }

export interface ApiErrorPayload {
  code: string
  message: string
  fields?: Record<string, string[]>
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status, headers: noStoreHeaders })
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const payload: ApiErrorPayload = {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    }
    return NextResponse.json({ success: false, error: payload }, { status: error.status, headers: noStoreHeaders })
  }

  if (error instanceof ZodError) {
    const fields = error.issues.reduce<Record<string, string[]>>((result, issue) => {
      const key = issue.path.join(".") || "form"
      return { ...result, [key]: [...(result[key] ?? []), issue.message] }
    }, {})
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fields },
      },
      { status: 400, headers: noStoreHeaders },
    )
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "JSON không hợp lệ." } },
      { status: 400, headers: noStoreHeaders },
    )
  }

  console.error("Unexpected API error", error)
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Đã xảy ra lỗi. Vui lòng thử lại." },
    },
    { status: 500, headers: noStoreHeaders },
  )
}
