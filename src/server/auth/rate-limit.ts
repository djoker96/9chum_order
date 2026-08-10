interface RateLimitEntry {
  timestamps: number[]
  expiresAt: number
}

export const MAX_RATE_LIMIT_KEYS = 10_000

const buckets = new Map<string, RateLimitEntry>()
let lastPrunedAt = 0

function pruneExpiredEntries(now: number): void {
  if (now < lastPrunedAt || now - lastPrunedAt >= 60_000) {
    for (const [key, entry] of buckets) {
      if (entry.expiresAt <= now) buckets.delete(key)
    }
    lastPrunedAt = now
  }
}

function evictOldestEntry(): void {
  const oldestKey = buckets.keys().next().value
  if (oldestKey !== undefined) buckets.delete(oldestKey)
}

export function allowRateLimit(identifier: string, maxRequests: number, windowMs: number, now = Date.now()): boolean {
  const entry = buckets.get(identifier)
  const recent = entry?.timestamps.filter((timestamp) => now - timestamp < windowMs) ?? []

  if (!entry) {
    pruneExpiredEntries(now)
    if (buckets.size >= MAX_RATE_LIMIT_KEYS) evictOldestEntry()
  }

  if (recent.length >= maxRequests) {
    buckets.set(identifier, { timestamps: recent, expiresAt: now + windowMs })
    return false
  }

  buckets.set(identifier, { timestamps: [...recent, now], expiresAt: now + windowMs })
  return true
}

export function allowLoginAttempt(identifier: string, now = Date.now()): boolean {
  return allowRateLimit(`login:${identifier}`, 10, 15 * 60 * 1000, now)
}

export function resetLoginRateLimit(): void {
  for (const key of buckets.keys()) {
    if (key.startsWith("login:")) buckets.delete(key)
  }
}

export function resetRateLimit(): void {
  buckets.clear()
  lastPrunedAt = 0
}
