import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { PanelLeftClose, PanelLeft, LogIn, LogOut, User } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { useAuth } from '~/lib/use-auth'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, isAuthenticated, isLoading, isLoggingIn, isLoggingOut, login, logout } = useAuth()

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

            {/* Auth status indicator */}
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="hidden sm:inline">{user.name || user.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user.name || 'User'}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()} disabled={isLoggingOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {isLoggingOut ? 'Logging out...' : 'Log out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => login()}
                  disabled={isLoggingIn}
                  className="gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  {isLoggingIn ? 'Logging in...' : 'Log in'}
                </Button>
              )}
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
