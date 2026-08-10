import { expect, test } from "@playwright/test"

test("production responses retain security headers", async ({ request }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Production security headers require an external production server")
  const response = await request.get("/api/health")
  const headers = response.headers()

  expect(response.status()).toBe(200)
  expect(headers["content-security-policy"]).toContain("default-src 'self'")
  expect(headers["strict-transport-security"]).toContain("max-age=31536000")
  expect(headers["x-content-type-options"]).toBe("nosniff")
  expect(headers["x-frame-options"]).toBe("DENY")
})

test("a forged Origin is rejected before login processing", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: {
      email: "attacker@example.com",
      password: "not-a-real-password",
    },
    headers: {
      Origin: "https://evil.example",
    },
    failOnStatusCode: false,
  })

  expect(response.status()).toBe(403)
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    error: { code: "CSRF_BLOCKED" },
  })
})
