"use client"

import type { ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ImpersonationBanner } from "@/features/admin/impersonation-banner" // klin:only admin
import { EmailVerificationBanner } from "@/features/auth/email-verification-banner" // klin:only password
import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

/** The signed-in app's frame: sidebar, top bar, banners, then the page. */
export function AppShell({ children, sidebarOpen }: { children: ReactNode; sidebarOpen: boolean }) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <ImpersonationBanner /> {/* klin:only admin */}
        <EmailVerificationBanner /> {/* klin:only password */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
