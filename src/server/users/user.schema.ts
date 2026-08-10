import { z } from "zod"

const roleSchema = z.enum(["ADMIN", "STAFF"])
const passwordSchema = z.string().min(12, "Mật khẩu phải có ít nhất 12 ký tự.").max(200, "Mật khẩu không được vượt quá 200 ký tự.")
const passwordConfirmationSchema = z.string().min(1, "Vui lòng xác nhận mật khẩu.").max(200)
const nameSchema = z.string().trim().max(100, "Tên không được vượt quá 100 ký tự.").nullable().optional()

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ.").max(320, "Email không được vượt quá 320 ký tự."),
  name: nameSchema,
  role: roleSchema.default("STAFF"),
  isActive: z.boolean().default(true),
  password: passwordSchema,
  passwordConfirmation: passwordConfirmationSchema,
}).superRefine((input, context) => {
  if (input.password !== input.passwordConfirmation) {
    context.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "Mật khẩu xác nhận không khớp." })
  }
})

export const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ.").max(320, "Email không được vượt quá 320 ký tự.").optional(),
  name: nameSchema,
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
  passwordConfirmation: passwordConfirmationSchema.optional(),
}).superRefine((input, context) => {
  if (input.password !== undefined && input.password !== input.passwordConfirmation) {
    context.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "Mật khẩu xác nhận không khớp." })
  }
  if (input.password === undefined && input.passwordConfirmation !== undefined) {
    context.addIssue({ code: "custom", path: ["password"], message: "Vui lòng nhập mật khẩu mới." })
  }
})

export type CreateUserInput = Omit<z.infer<typeof createUserSchema>, "passwordConfirmation">
export type UpdateUserInput = Omit<z.infer<typeof updateUserSchema>, "passwordConfirmation">
