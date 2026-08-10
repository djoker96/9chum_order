import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginScreen() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md gap-0 overflow-hidden shadow-xl">
        <CardHeader className="gap-3 border-b bg-card p-8">
          <CardTitle className="text-2xl">Đăng nhập</CardTitle>
          <CardDescription className="text-sm">Sử dụng tài khoản nhân viên được cấp.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
