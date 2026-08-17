interface RateLimitEntry {
  timestamps: number[]
  expiresAt: number
}

export const MAX_RATE_LIMIT_KEYS = 10_000
export const LOGIN_MAX_FAILURES = 10
export const LOGIN_IP_MAX_FAILURES = 60
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

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

function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase()
}

function accountLoginKey(email: string): string {
  return `login:account:${normalizeLoginEmail(email)}`
}

function loginBuckets(email: string, ip: string): Array<{ identifier: string; maxRequests: number }> {
  const accountBucket = { identifier: accountLoginKey(email), maxRequests: LOGIN_MAX_FAILURES }
  if (ip === "unknown") return [accountBucket]

  return [
    accountBucket,
    { identifier: `login:ip:${ip}`, maxRequests: LOGIN_IP_MAX_FAILURES },
  ]
}

function isRateLimitReached(identifier: string, maxRequests: number, windowMs: number, now: number): boolean {
  const entry = buckets.get(identifier)
  if (!entry) return false

  return entry.timestamps.filter((timestamp) => now - timestamp < windowMs).length >= maxRequests
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

export function isLoginAttemptAllowed(email: string, ip: string, now = Date.now()): boolean {
  return loginBuckets(email, ip).every(({ identifier, maxRequests }) => (
    !isRateLimitReached(identifier, maxRequests, LOGIN_WINDOW_MS, now)
  ))
}

export function recordLoginFailure(email: string, ip: string, now = Date.now()): void {
  for (const { identifier, maxRequests } of loginBuckets(email, ip)) {
    allowRateLimit(identifier, maxRequests, LOGIN_WINDOW_MS, now)
  }
}

export function clearLoginFailures(email: string): void {
  buckets.delete(accountLoginKey(email))
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
