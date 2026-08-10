import { describe, expect, it } from "vitest"
import { allowLoginAttempt, allowRateLimit, MAX_RATE_LIMIT_KEYS, resetLoginRateLimit, resetRateLimit } from "@/server/auth/rate-limit"

describe("rate limiting", () => {
  it("limits a key within a time window and allows it after expiry", () => {
    expect(allowRateLimit("unit-key", 2, 1000, 1000)).toBe(true)
    expect(allowRateLimit("unit-key", 2, 1000, 1001)).toBe(true)
    expect(allowRateLimit("unit-key", 2, 1000, 1002)).toBe(false)
    expect(allowRateLimit("unit-key", 2, 1000, 2001)).toBe(true)
  })

  it("can reset login attempts between tests", () => {
    resetLoginRateLimit()
    expect(allowLoginAttempt("login-unit", 1000)).toBe(true)
    resetLoginRateLimit()
    expect(allowLoginAttempt("login-unit", 1000)).toBe(true)
  })

  it("bounds memory used for attacker-controlled identifiers", () => {
    resetRateLimit()

    for (let index = 0; index < MAX_RATE_LIMIT_KEYS; index += 1) {
      expect(allowRateLimit(`bounded-${index}`, 1, 60_000, 1_000)).toBe(true)
    }

    expect(allowRateLimit("bounded-overflow", 1, 60_000, 1_000)).toBe(true)
    expect(allowRateLimit("bounded-0", 1, 60_000, 1_000)).toBe(true)

    resetRateLimit()
  })
})
