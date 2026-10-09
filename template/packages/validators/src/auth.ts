import { z } from "zod"
import { emailSchema, nameSchema, passwordSchema } from "./common"

/* Forms for the auth pages. Better Auth validates again on the server. */

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean(),
})
export type SignInInput = z.input<typeof signInSchema>

export const signUpSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
export type SignUpInput = z.input<typeof signUpSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
export type ChangePasswordInput = z.input<typeof changePasswordSchema>

export const updateProfileSchema = z.object({ name: nameSchema })
export type UpdateProfileInput = z.input<typeof updateProfileSchema>

/** Re-enter your password before something sensitive. */
export const confirmPasswordSchema = z.object({
  password: z.string().min(1, "Enter your password"),
})
export type ConfirmPasswordInput = z.input<typeof confirmPasswordSchema>
// klin:if magic-link

export const magicLinkSchema = z.object({ email: emailSchema })
export type MagicLinkInput = z.input<typeof magicLinkSchema>
// klin:endif
// klin:if two-factor

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
  trustDevice: z.boolean(),
})
export type TotpCodeInput = z.input<typeof totpCodeSchema>

export const backupCodeSchema = z.object({
  code: z.string().trim().min(8, "Backup codes are at least 8 characters"),
})
export type BackupCodeInput = z.input<typeof backupCodeSchema>
// klin:endif
