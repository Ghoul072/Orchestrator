import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <TooltipProvider>
      <div className="flex h-screen">
        <Sidebar collapsed={sidebarCollapsed} />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? (
                    <PanelLeft className="h-5 w-5" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {/* User section - placeholder for auth */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted" />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
