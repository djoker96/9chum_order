import { describe, expect, it } from "vitest"
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token"

describe("session tokens", () => {
  it("creates a high-entropy token and a stable one-way hash", () => {
    const token = createSessionToken()

    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
    expect(hashSessionToken(token)).not.toBe(token)
  })

  it("does not reuse tokens across calls", () => {
    expect(createSessionToken()).not.toBe(createSessionToken())
  })
})
