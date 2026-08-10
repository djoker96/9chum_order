import { describe, expect, it } from "vitest"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"

describe("same-origin protection", () => {
  it("allows same-origin and non-browser requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST" }))).not.toThrow()
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "http://localhost:3000" } }))).not.toThrow()
  })

  it("rejects cross-origin mutation requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "https://attacker.example" } }))).toThrow("Yêu cầu không hợp lệ.")
  })

  it("rejects malformed origins and throttles repeated requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { headers: { origin: "not-an-origin" } }))).toThrow("Yêu cầu không hợp lệ.")
    const scope = `test-${Date.now()}`
    const request = new Request("http://localhost:3000/api/test", { headers: { "x-forwarded-for": scope } })
    expect(() => assertApiRateLimit(request, scope, 1)).not.toThrow()
    expect(() => assertApiRateLimit(request, scope, 1)).toThrow("Bạn gửi quá nhiều yêu cầu")
  })
})
