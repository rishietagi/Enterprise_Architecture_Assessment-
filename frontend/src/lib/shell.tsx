import { createContext, useContext, useState, type ReactNode } from 'react'

interface Shell {
  coachOpen: boolean
  setCoachOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
}

const ShellContext = createContext<Shell | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [coachOpen, setCoachOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <ShellContext.Provider value={{ coachOpen, setCoachOpen, settingsOpen, setSettingsOpen }}>
      {children}
    </ShellContext.Provider>
  )
}

export function useShell(): Shell {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell outside ShellProvider')
  return ctx
}
