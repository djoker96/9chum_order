// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { GET } from "@/app/api/health/route"

describe("health endpoint with PostgreSQL", () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("reports ready against a migrated database", async () => {
    const migrationRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
    `

    const response = await GET()

    expect(Number(migrationRows[0]?.count ?? 0)).toBeGreaterThan(0)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: "ready" },
    })
  })
})
