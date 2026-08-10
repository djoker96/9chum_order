import { z } from "zod"

const optionalEnvString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional())
const optionalEnvEmail = z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional())

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "AUTH_COOKIE_NAME chỉ được chứa chữ, số, _ hoặc -.").default("9chum_order_session"),
  GOOGLE_PROJECT_ID: optionalEnvString,
  GOOGLE_CLIENT_EMAIL: optionalEnvEmail,
  GOOGLE_PRIVATE_KEY: optionalEnvString,
  GOOGLE_SHEET_ID: optionalEnvString,
  GOOGLE_SHEET_NAME: z.string().min(1).default("Products"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env)
}
