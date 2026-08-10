import "dotenv/config"
import { PrismaClient, UserRole } from "@prisma/client"
import { hashPassword } from "../src/server/auth/password"

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password || password.length < 12) {
    throw new Error("ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required")
  }

  const passwordHash = await hashPassword(password)

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { email, passwordHash, role: UserRole.ADMIN, name: "Administrator" },
  })
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
