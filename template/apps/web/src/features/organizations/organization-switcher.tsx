import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon, UserIcon } from "lucide-react"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useCurrentSession } from "@/lib/session"
import { useOrganizations, useSetActiveOrganization } from "./api"
import { CreateOrganizationDialog } from "./create-organization-dialog"

export function OrganizationSwitcher() {
  const session = useCurrentSession()
  const { data: organizations = [] } = useOrganizations()
  const setActive = useSetActiveOrganization()
  const [creating, setCreating] = useState(false)

  const activeId = session.session.activeOrganizationId
  const active = organizations.find((org) => org.id === activeId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton className="border bg-background shadow-xs" />}>
            {active ? <Building2Icon /> : <UserIcon />}
            <span className="truncate">{active?.name ?? "Personal"}</span>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--anchor-width) min-w-56" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setActive.mutate(null)}>
                <UserIcon /> Personal
                {!active && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              {organizations.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => setActive.mutate(org.id)}>
                  <Building2Icon /> <span className="truncate">{org.name}</span>
                  {org.id === activeId && <CheckIcon className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreating(true)}>
              <PlusIcon /> Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
