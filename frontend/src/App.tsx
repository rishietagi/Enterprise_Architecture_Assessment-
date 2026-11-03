import type { CSSProperties } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppSidebar } from '@/components/AppSidebar'
import { CoachSheet } from '@/components/CoachSheet'
import { SettingsSheet } from '@/components/SettingsSheet'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ShellProvider } from '@/lib/shell'
import Applications from '@/pages/Applications'
import Approach from '@/pages/Approach'
import Business from '@/pages/Business'
import Dashboard from '@/pages/Dashboard'
import DataTech from '@/pages/DataTech'
import Roadmap from '@/pages/Roadmap'
import Vision from '@/pages/Vision'

export default function App() {
  return (
    <ShellProvider>
      <SidebarProvider style={{ '--sidebar-width': '15.5rem' } as CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-6 pt-5 pb-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/approach" element={<Approach />} />
              <Route path="/vision" element={<Vision />} />
              <Route path="/business" element={<Business />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/data-tech" element={<DataTech />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </main>
        </SidebarInset>
        <CoachSheet />
        <SettingsSheet />
      </SidebarProvider>
    </ShellProvider>
  )
}
