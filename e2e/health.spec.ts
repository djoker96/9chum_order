import { expect, test } from "@playwright/test"

test("public health endpoint reports database readiness", async ({ request }) => {
  const response = await request.get("/api/health", { failOnStatusCode: false })

  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  expect(await response.json()).toEqual({
    success: true,
    data: { status: "ready" },
  })
})
