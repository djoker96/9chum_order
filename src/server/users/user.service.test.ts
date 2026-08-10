import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppError } from "@/server/http/api"
import { hashPassword } from "@/server/auth/password"
import { createUser, listUsers, updateUser, type UserAdminRecord, type UserRepository } from "@/server/users/user.service"

vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}))

const admin: UserAdminRecord = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Administrator",
  role: "ADMIN",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

function makeRepository(overrides: Partial<Record<keyof UserRepository, unknown>> = {}): UserRepository {
  return {
    findById: vi.fn(async () => admin),
    findByEmail: vi.fn(async () => null),
    countActiveAdmins: vi.fn(async () => 2),
    create: vi.fn(async () => ({ ...admin, id: "created-1" })),
    update: vi.fn(async (_id, input) => ({ ...admin, ...input })),
    deleteSessionsByUserId: vi.fn(async () => undefined),
    ...overrides,
  } as UserRepository
}

describe("user service", () => {
  beforeEach(() => vi.clearAllMocks())

  it("hashes the password and creates an active staff account", async () => {
    const repository = makeRepository()

    const result = await createUser({
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: true,
      password: "a-secure-password",
    }, repository)

    expect(hashPassword).toHaveBeenCalledWith("a-secure-password")
    expect(repository.create).toHaveBeenCalledWith({
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: true,
      passwordHash: "hashed:a-secure-password",
    })
    expect(result).not.toHaveProperty("passwordHash")
  })

  it("passes list filters to the repository", async () => {
    const repository = makeRepository({ list: vi.fn(async () => ({ users: [admin], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })) })
    const result = await listUsers({ role: "ADMIN", status: "ACTIVE" }, repository)

    expect(repository.list).toHaveBeenCalledWith({ role: "ADMIN", status: "ACTIVE" })
    expect(result.users).toHaveLength(1)
  })

  it("rejects duplicate email before writing", async () => {
    const repository = makeRepository({ findByEmail: vi.fn(async () => admin) })

    await expect(createUser({
      email: "admin@example.com",
      name: "Another",
      role: "STAFF",
      isActive: true,
      password: "a-secure-password",
    }, repository)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
      status: 409,
    })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it("does not allow the last active admin to be disabled", async () => {
    const repository = makeRepository({
      findById: vi.fn(async () => admin),
      countActiveAdmins: vi.fn(async () => 1),
    })

    await expect(updateUser("admin-1", { isActive: false }, "other-admin", repository)).rejects.toMatchObject({
      code: "LAST_ACTIVE_ADMIN",
      status: 409,
    })
    expect(repository.update).not.toHaveBeenCalled()
  })

  it("returns not found when updating an unknown account", async () => {
    const repository = makeRepository({ findById: vi.fn(async () => null) })

    await expect(updateUser("missing", { name: "Missing" }, "admin-1", repository)).rejects.toMatchObject({ code: "USER_NOT_FOUND", status: 404 })
  })

  it("allows changing a non-final admin and normalizes an empty name", async () => {
    const repository = makeRepository({ update: vi.fn(async () => ({ ...admin, role: "STAFF", name: null })) })

    await updateUser("admin-2", { role: "STAFF", name: "   " }, "admin-1", repository)

    expect(repository.update).toHaveBeenCalledWith("admin-2", { role: "STAFF", name: null })
  })

  it("returns the current account when an update has no changes", async () => {
    const repository = makeRepository()

    await expect(updateUser("admin-1", {}, "other-admin", repository)).resolves.toEqual(admin)
    expect(repository.update).not.toHaveBeenCalled()
  })

  it("does not allow an admin to lower their own role or disable themselves", async () => {
    const repository = makeRepository()

    await expect(updateUser("admin-1", { role: "STAFF" }, "admin-1", repository)).rejects.toBeInstanceOf(AppError)
    await expect(updateUser("admin-1", { isActive: false }, "admin-1", repository)).rejects.toMatchObject({ code: "SELF_LOCKOUT" })
    expect(repository.update).not.toHaveBeenCalled()
  })

  it("revokes all sessions after a password reset", async () => {
    const repository = makeRepository()

    await updateUser("admin-1", { password: "a-new-secure-password" }, "other-admin", repository)

    expect(hashPassword).toHaveBeenCalledWith("a-new-secure-password")
    expect(repository.deleteSessionsByUserId).toHaveBeenCalledWith("admin-1")
  })

  it("revokes all sessions when an account is deactivated", async () => {
    const staff: UserAdminRecord = { ...admin, id: "staff-1", email: "staff@example.com", role: "STAFF" }
    const repository = makeRepository({
      findById: vi.fn(async () => staff),
      update: vi.fn(async () => ({ ...staff, isActive: false })),
    })

    await updateUser("staff-1", { isActive: false }, "admin-1", repository)

    expect(repository.deleteSessionsByUserId).toHaveBeenCalledWith("staff-1")
  })
})
