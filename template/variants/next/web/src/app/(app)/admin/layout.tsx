// klin:file admin
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getServerSession } from "@/lib/server-session"

/** Admin area guard: only admins get in (the API checks the role too). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession()
  if (session?.user.role !== "admin") redirect("/dashboard")
  return children
}
