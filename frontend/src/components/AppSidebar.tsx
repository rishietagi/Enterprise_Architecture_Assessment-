import { useQuery } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, GraduationCap, LogOut, Settings } from 'lucide-react'
import { useEngagement } from '@/components/Gate'
import { useAuth } from '@/components/Login'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import { SCREENS, screenForPath } from '@/lib/screens'
import { useShell } from '@/lib/shell'
import { BAND, SLATE_LIGHT } from '@/lib/theme'

export function AppSidebar() {
  const { pathname } = useLocation()
  const active = screenForPath(pathname)
  const { setCoachOpen, setSettingsOpen } = useShell()
  const { leave } = useEngagement()
  const auth = useAuth()
  const navigate = useNavigate()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then((r) => r.json() as Promise<{ rag: string; llm_key: boolean }>),
    staleTime: 60_000,
  })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4 pb-3">
        <div className="flex flex-col gap-1.5">
          <img src="/kpmg-logo-white.png" alt="KPMG" className="h-9 w-auto self-start object-contain group-data-[collapsible=icon]:h-5" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[12.5px] font-semibold text-white">EA Assessment Tool</div>
            <div className="truncate text-[11px] text-white/60">Coromandel International · TOGAF 9.1</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/45">Assessment</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {SCREENS.map((s) => (
                <SidebarMenuItem key={s.key}>
                  <SidebarMenuButton asChild isActive={active.key === s.key} tooltip={s.nav} className="h-10">
                    <NavLink to={s.path} end={s.path === '/'}>
                      <s.icon />
                      <span className="flex-1 truncate">{s.nav}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  <div className="pointer-events-none absolute top-2.5 right-2 flex gap-0.5 group-data-[collapsible=icon]:hidden">
                    {s.badges.map((p) => (
                      <span key={p} className="rounded bg-white/10 px-1 py-px text-[9.5px] leading-[14px] font-semibold text-white/75">
                        {p}
                      </span>
                    ))}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-1 px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="TOGAF Coach" onClick={() => setCoachOpen(true)}>
              <GraduationCap /> <span>TOGAF Coach</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" onClick={() => setSettingsOpen(true)}>
              <Settings /> <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Switch engagement" onClick={() => { leave(); navigate('/') }}>
              <ArrowLeftRight /> <span>Switch Engagement</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {auth.required && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sign out" onClick={() => { leave(); navigate('/'); auth.logout() }}>
                <LogOut /> <span>Sign Out{auth.user ? ` (${auth.user})` : ''}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {health.data && (
          <div className="mx-2 mt-1 flex items-center gap-1.5 text-[11px] text-white/50 group-data-[collapsible=icon]:hidden">
            <span className="size-1.5 rounded-full" style={{ background: health.data.llm_key ? BAND.strong : SLATE_LIGHT }} />
            {health.data.llm_key ? 'Gemini on' : 'Offline mode'} · {health.data.rag === 'hybrid' ? 'hybrid RAG' : `${health.data.rag} RAG`}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
