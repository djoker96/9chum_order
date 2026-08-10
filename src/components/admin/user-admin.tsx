"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { AdminNavigation } from "@/components/admin/admin-navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type UserRole = "ADMIN" | "STAFF"
type UserStatusFilter = "ACTIVE" | "INACTIVE" | "ALL"

interface UserAdminRecord {
  id: string
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface UserListResponse {
  users: UserAdminRecord[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

interface UserFormState {
  email: string
  name: string
  role: UserRole
  isActive: boolean
  password: string
  passwordConfirmation: string
}

const emptyForm: UserFormState = {
  email: "",
  name: "",
  role: "STAFF",
  isActive: true,
  password: "",
  passwordConfirmation: "",
}

function getErrorMessage(payload: { error?: { message?: string } }, fallback: string): string {
  return payload.error?.message || fallback
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN")
}

export function UserAdmin() {
  const [result, setResult] = useState<UserListResponse | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL")
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("ALL")
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [editingUser, setEditingUser] = useState<UserAdminRecord | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", role: roleFilter, status: statusFilter })
      if (search) params.set("search", search)
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json() as { success: boolean; data?: UserListResponse; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(getErrorMessage(payload, "Không thể tải danh sách tài khoản."))
      setResult(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách tài khoản.")
    } finally {
      setIsLoading(false)
    }
  }, [page, roleFilter, search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  function openCreateForm(): void {
    setEditingUser(null)
    setForm({ ...emptyForm })
    setMessage(null)
    setError(null)
    setIsFormOpen(true)
  }

  function openEditForm(user: UserAdminRecord): void {
    setEditingUser(user)
    setForm({
      email: user.email,
      name: user.name || "",
      role: user.role,
      isActive: user.isActive,
      password: "",
      passwordConfirmation: "",
    })
    setMessage(null)
    setError(null)
    setIsFormOpen(true)
  }

  function closeForm(): void {
    setIsFormOpen(false)
    setEditingUser(null)
    setForm({ ...emptyForm })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function submitForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setMessage(null)

    const payload: Record<string, unknown> = {
      email: form.email,
      name: form.name.trim() || null,
      role: form.role,
      isActive: form.isActive,
    }
    if (!editingUser || form.password) {
      payload.password = form.password
      payload.passwordConfirmation = form.passwordConfirmation
    }

    try {
      const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users"
      const response = await fetch(endpoint, {
        method: editingUser ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json() as { success: boolean; error?: { message?: string } }
      if (!response.ok || !responsePayload.success) throw new Error(getErrorMessage(responsePayload, "Không thể lưu tài khoản."))
      setMessage(editingUser ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản mới.")
      closeForm()
      await loadUsers()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu tài khoản.")
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleUser(user: UserAdminRecord): Promise<void> {
    if (user.isActive && !window.confirm(`Vô hiệu hóa tài khoản ${user.email}?`)) return
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const payload = await response.json() as { success: boolean; error?: { message?: string } }
      if (!response.ok || !payload.success) throw new Error(getErrorMessage(payload, "Không thể cập nhật trạng thái tài khoản."))
      setMessage(user.isActive ? "Đã vô hiệu hóa tài khoản." : "Đã kích hoạt tài khoản.")
      await loadUsers()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Không thể cập nhật trạng thái tài khoản.")
    }
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation active="users" />
        <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Quản lý tài khoản</h1>
            <p className="mt-2 text-sm text-muted-foreground">Quản lý quyền truy cập của nhân viên trong hệ thống.</p>
          </div>
          <Button type="button" onClick={openCreateForm}>Tạo tài khoản</Button>
        </header>

        {message && <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800"><AlertDescription>{message}</AlertDescription></Alert>}
        {error && <Alert className="mb-4" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {isFormOpen && (
          <Card className="mb-6 shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{editingUser ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"}</CardTitle>
                  <CardDescription className="mt-1">Mật khẩu phải có ít nhất 12 ký tự và sẽ không được hiển thị lại.</CardDescription>
                </div>
                <Button type="button" variant="ghost" onClick={closeForm}>Đóng</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitForm(event)}>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input id="user-email" name="email" type="email" autoComplete="username" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-name">Tên hiển thị</Label>
                  <Input id="user-name" name="name" autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Vai trò</Label>
                  <select id="user-role" className="h-10 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
                    <option value="STAFF">Nhân viên (STAFF)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                    Tài khoản đang hoạt động
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">{editingUser ? "Mật khẩu mới" : "Mật khẩu"}</Label>
                  <Input id="user-password" name="password" type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required={!editingUser} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password-confirmation">Xác nhận mật khẩu</Label>
                  <Input id="user-password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} value={form.passwordConfirmation} onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} required={!editingUser && form.password.length > 0} />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={isSaving}>{isSaving ? "Đang lưu..." : "Lưu tài khoản"}</Button>
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>Hủy</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="gap-0 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
              <form className="flex flex-1 gap-2" onSubmit={submitSearch}>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="user-search">Tìm tài khoản</Label>
                  <Input id="user-search" aria-label="Tìm tài khoản" placeholder="Tìm theo email hoặc tên" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                </div>
                <Button className="mt-auto" type="submit" variant="outline">Tìm kiếm</Button>
              </form>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <div className="space-y-2">
                  <Label htmlFor="user-role-filter">Vai trò</Label>
                  <select id="user-role-filter" className="h-10 rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={roleFilter} onChange={(event) => { setPage(1); setRoleFilter(event.target.value as UserRole | "ALL") }}>
                    <option value="ALL">Tất cả vai trò</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="STAFF">STAFF</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-status-filter">Trạng thái</Label>
                  <select id="user-status-filter" className="h-10 rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value as UserStatusFilter) }}>
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Đã vô hiệu hóa</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-4 text-sm text-muted-foreground"><strong className="text-2xl font-semibold text-foreground">{result?.pagination.total ?? 0}</strong><span> tài khoản</span></div>
            {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Đang tải...</p>}
            {!isLoading && result?.users.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tài khoản phù hợp.</p>}
            {!isLoading && result && result.users.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>Tài khoản</TableHead><TableHead>Vai trò</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày tạo</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
                <TableBody>{result.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><div className="grid gap-1"><span className="font-medium">{user.email}</span><small className="text-muted-foreground">{user.name || "Chưa cập nhật tên"}</small></div></TableCell>
                    <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={user.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}>{user.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</Badge></TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => openEditForm(user)}>Sửa</Button><Button type="button" variant={user.isActive ? "destructive" : "outline"} size="sm" onClick={() => void toggleUser(user)}>{user.isActive ? "Tắt" : "Bật"}</Button></div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
            {result && result.pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button>
                <span className="text-sm text-muted-foreground">Trang {page} / {result.pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Sau</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
