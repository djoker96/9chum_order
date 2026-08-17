import { describe, expect, it } from "vitest"
import {
  allowRateLimit,
  clearLoginFailures,
  isLoginAttemptAllowed,
  MAX_RATE_LIMIT_KEYS,
  recordLoginFailure,
  resetLoginRateLimit,
  resetRateLimit,
} from "@/server/auth/rate-limit"

describe("rate limiting", () => {
  it("limits a key within a time window and allows it after expiry", () => {
    expect(allowRateLimit("unit-key", 2, 1000, 1000)).toBe(true)
    expect(allowRateLimit("unit-key", 2, 1000, 1001)).toBe(true)
    expect(allowRateLimit("unit-key", 2, 1000, 1002)).toBe(false)
    expect(allowRateLimit("unit-key", 2, 1000, 2001)).toBe(true)
  })

  it("does not share an unknown-IP login limit between accounts", () => {
    resetLoginRateLimit()

    for (let index = 0; index < 10; index += 1) {
      recordLoginFailure("admin@example.com", "unknown", 1000 + index)
    }

    expect(isLoginAttemptAllowed("admin@example.com", "unknown", 1010)).toBe(false)
    expect(isLoginAttemptAllowed("staff@example.com", "unknown", 1010)).toBe(true)
  })

  it("does not count successful login attempts after clearing failures", () => {
    resetLoginRateLimit()

    recordLoginFailure("admin@example.com", "203.0.113.7", 1000)
    clearLoginFailures("admin@example.com")

    expect(isLoginAttemptAllowed("admin@example.com", "203.0.113.7", 1001)).toBe(true)
  })

  it("allows more shared-IP attempts than the per-account limit", () => {
    resetLoginRateLimit()

    for (let index = 0; index < 10; index += 1) {
      recordLoginFailure(`user-${index}@example.com`, "203.0.113.7", 1000 + index)
    }

    expect(isLoginAttemptAllowed("new-user@example.com", "203.0.113.7", 1010)).toBe(true)
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
