export type UserRole = "ADMIN" | "STAFF"

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  role: UserRole
}

export function hasRole(user: AuthenticatedUser, role: UserRole): boolean {
  return user.role === role
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, "ADMIN")
}
