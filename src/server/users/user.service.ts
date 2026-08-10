import { Prisma } from "@prisma/client"
import { hashPassword } from "@/server/auth/password"
import { AppError } from "@/server/http/api"
import type { CreateUserInput, UpdateUserInput } from "@/server/users/user.schema"
import { userRepository } from "@/server/users/user.repository"
import type { UserAdminRecord, UserRepository } from "@/server/users/user.types"

export type { UserAdminRecord, UserRepository } from "@/server/users/user.types"
export type { CreateUserInput, UpdateUserInput } from "@/server/users/user.schema"

function normalizeName(name: string | null | undefined): string | null {
  if (name === undefined || name === null) return null
  const normalized = name.trim()
  return normalized || null
}

function duplicateEmailError(): AppError {
  return new AppError(409, "EMAIL_ALREADY_EXISTS", "Email đã được sử dụng.")
}

function isUniqueEmailError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function assertNoDuplicateEmail(user: UserAdminRecord | null): void {
  if (user) throw duplicateEmailError()
}

export async function listUsers(filters: Parameters<UserRepository["list"]>[0] = {}, repository: UserRepository = userRepository) {
  return repository.list(filters)
}

export async function createUser(input: CreateUserInput, repository: UserRepository = userRepository): Promise<UserAdminRecord> {
  assertNoDuplicateEmail(await repository.findByEmail(input.email))

  try {
    return await repository.create({
      email: input.email,
      name: normalizeName(input.name),
      role: input.role,
      isActive: input.isActive,
      passwordHash: await hashPassword(input.password),
    })
  } catch (error) {
    if (isUniqueEmailError(error)) throw duplicateEmailError()
    throw error
  }
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  requesterId: string,
  repository: UserRepository = userRepository,
): Promise<UserAdminRecord> {
  const current = await repository.findById(id)
  if (!current) throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.")

  const nextRole = input.role ?? current.role
  const nextIsActive = input.isActive ?? current.isActive
  const changesOwnAccount = id === requesterId

  if (changesOwnAccount && (nextRole !== current.role || nextIsActive !== current.isActive)) {
    throw new AppError(409, "SELF_LOCKOUT", "Bạn không thể tự hạ quyền hoặc vô hiệu hóa tài khoản của mình.")
  }

  if (current.role === "ADMIN" && current.isActive && (nextRole !== "ADMIN" || !nextIsActive)) {
    const activeAdminCount = await repository.countActiveAdmins()
    if (activeAdminCount <= 1) {
      throw new AppError(409, "LAST_ACTIVE_ADMIN", "Không thể vô hiệu hóa hoặc hạ quyền admin cuối cùng.")
    }
  }

  if (input.email && input.email !== current.email) {
    assertNoDuplicateEmail(await repository.findByEmail(input.email))
  }

  const passwordHash = input.password === undefined ? undefined : await hashPassword(input.password)
  const shouldRevokeSessions = passwordHash !== undefined || (input.isActive === false && current.isActive)
  const changes = {
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  }

  if (Object.keys(changes).length === 0) return current

  try {
    const updated = await repository.update(id, changes)
    if (shouldRevokeSessions) await repository.deleteSessionsByUserId(id)
    return updated
  } catch (error) {
    if (isUniqueEmailError(error)) throw duplicateEmailError()
    throw error
  }
}
