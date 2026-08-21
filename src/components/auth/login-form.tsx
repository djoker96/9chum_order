"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      })
      const payload = await response.json() as {
        success: boolean
        error?: { message?: string }
      }

      if (!response.ok || !payload.success) {
        setError(payload.error?.message || "Không thể đăng nhập.")
        return
      }

      router.push("/invoices/create")
      router.refresh()
    } catch {
      setError("Không thể kết nối tới máy chủ.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <Label className="w-fit cursor-pointer" htmlFor="rememberMe">
        <input id="rememberMe" name="rememberMe" type="checkbox" className="size-4 accent-primary" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
        Lưu đăng nhập
      </Label>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button className="h-10 w-full text-sm" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  )
}
