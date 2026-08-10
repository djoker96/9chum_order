import type { UserRole } from "@/server/auth/permissions"

export interface UserAdminRecord {
  id: string
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserCreateData {
  email: string
  passwordHash: string
  name: string | null
  role: UserRole
  isActive: boolean
}

export interface UserUpdateData {
  email?: string
  passwordHash?: string
  name?: string | null
  role?: UserRole
  isActive?: boolean
}

export interface UserListFilters {
  search?: string
  role?: UserRole | "ALL"
  status?: "ACTIVE" | "INACTIVE" | "ALL"
  page?: number
  pageSize?: number
}

export interface UserRepository {
  findById(id: string): Promise<UserAdminRecord | null>
  findByEmail(email: string): Promise<UserAdminRecord | null>
  list(filters?: UserListFilters): Promise<{
    users: UserAdminRecord[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>
  countActiveAdmins(): Promise<number>
  create(data: UserCreateData): Promise<UserAdminRecord>
  update(id: string, data: UserUpdateData): Promise<UserAdminRecord>
  deleteSessionsByUserId(userId: string): Promise<void>
}
