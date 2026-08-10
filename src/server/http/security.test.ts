import { afterEach, describe, expect, it, vi } from "vitest"
import {
  assertApiRateLimit,
  assertSameOrigin,
  getClientIp,
} from "@/server/http/security"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("same-origin protection", () => {
  it("allows same-origin and non-browser requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST" }))).not.toThrow()
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "http://localhost:3000" } }))).not.toThrow()
  })

  it("rejects cross-origin mutation requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "https://attacker.example" } }))).toThrow("Yêu cầu không hợp lệ.")
  })

  it("uses the configured public origin instead of spoofable proxy headers", () => {
    vi.stubEnv("APP_ORIGIN", "https://donhang.9chum.vn")
    const legitimate = new Request("http://app:3000/api/test", {
      method: "POST",
      headers: {
        origin: "https://donhang.9chum.vn",
        host: "attacker.example",
        "x-forwarded-proto": "http",
      },
    })
    const forged = new Request("http://app:3000/api/test", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        host: "attacker.example",
        "x-forwarded-proto": "https",
      },
    })

    expect(() => assertSameOrigin(legitimate)).not.toThrow()
    expect(() => assertSameOrigin(forged)).toThrow("Yêu cầu không hợp lệ.")
  })

  it("takes only the proxy-appended final valid client address", () => {
    expect(
      getClientIp(
        new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": "198.51.100.25, 203.0.113.7" },
        }),
      ),
    ).toBe("203.0.113.7")
    expect(
      getClientIp(
        new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": "forged-value" },
        }),
      ),
    ).toBe("unknown")
  })

  it("rejects malformed origins and throttles repeated requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/test", { headers: { origin: "not-an-origin" } }))).toThrow("Yêu cầu không hợp lệ.")
    const scope = `test-${Date.now()}`
    const request = new Request("http://localhost:3000/api/test", { headers: { "x-forwarded-for": scope } })
    expect(() => assertApiRateLimit(request, scope, 1)).not.toThrow()
    expect(() => assertApiRateLimit(request, scope, 1)).toThrow("Bạn gửi quá nhiều yêu cầu")
  })
})
