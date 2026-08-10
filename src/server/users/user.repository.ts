import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { UserAdminRecord, UserCreateData, UserListFilters, UserRepository, UserUpdateData } from "@/server/users/user.types"

function toUserAdminRecord(user: {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "STAFF"
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): UserAdminRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export const userRepository: UserRepository = {
  async findById(id) {
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect })
    return user ? toUserAdminRecord(user) : null
  },

  async findByEmail(email) {
    const user = await prisma.user.findUnique({ where: { email }, select: userSelect })
    return user ? toUserAdminRecord(user) : null
  },

  async list(filters = {}) {
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 20
    const search = filters.search?.trim()
    const where: Prisma.UserWhereInput = {
      ...(filters.role && filters.role !== "ALL" ? { role: filters.role } : {}),
      ...(filters.status === "ACTIVE" ? { isActive: true } : {}),
      ...(filters.status === "INACTIVE" ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return {
      users: users.map(toUserAdminRecord),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  },

  async countActiveAdmins() {
    return prisma.user.count({ where: { role: "ADMIN", isActive: true } })
  },

  async create(data: UserCreateData) {
    const user = await prisma.user.create({ data, select: userSelect })
    return toUserAdminRecord(user)
  },

  async update(id: string, data: UserUpdateData) {
    const user = await prisma.user.update({ where: { id }, data, select: userSelect })
    return toUserAdminRecord(user)
  },

  async deleteSessionsByUserId(userId: string) {
    await prisma.session.deleteMany({ where: { userId } })
  },
}
