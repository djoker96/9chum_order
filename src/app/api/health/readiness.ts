import { prisma } from "@/lib/prisma"

const readinessCacheDurationMs = 1_000
const failureLogIntervalMs = 30_000

interface CachedReadiness {
  checkedAt: number
  ready: boolean
}

let cachedReadiness: CachedReadiness | undefined
let readinessProbe: Promise<boolean> | undefined
let lastFailureLogAt = 0

async function checkDatabaseReadiness(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 AS ready`
    return true
  } catch {
    const now = Date.now()
    if (now - lastFailureLogAt >= failureLogIntervalMs) {
      console.error("Database health check failed")
      lastFailureLogAt = now
    }
    return false
  }
}

export function getDatabaseReadiness(): Promise<boolean> {
  const now = Date.now()
  if (
    cachedReadiness &&
    now - cachedReadiness.checkedAt < readinessCacheDurationMs
  ) {
    return Promise.resolve(cachedReadiness.ready)
  }

  if (!readinessProbe) {
    readinessProbe = checkDatabaseReadiness()
      .then((ready) => {
        cachedReadiness = { checkedAt: Date.now(), ready }
        return ready
      })
      .finally(() => {
        readinessProbe = undefined
      })
  }

  return readinessProbe
}

/** @internal Used only to isolate the process-local cache in unit tests. */
export function resetHealthCheckStateForTests(): void {
  cachedReadiness = undefined
  readinessProbe = undefined
  lastFailureLogAt = 0
}
