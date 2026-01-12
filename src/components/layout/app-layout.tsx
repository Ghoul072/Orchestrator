import { Outlet, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { PanelLeftClose, PanelLeft, MessageSquare, PanelRightClose } from 'lucide-react'
import { Sidebar } from './sidebar'
import { ChatPanel } from '~/components/chat/chat-panel'
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Try to get projectId from URL params for chat context
  const params = useParams({ strict: false }) as { projectId?: string }
  const projectId = params.projectId

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

            {/* Chat toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={chatOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setChatOpen(!chatOpen)}
                >
                  {chatOpen ? (
                    <PanelRightClose className="h-5 w-5" />
                  ) : (
                    <MessageSquare className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {chatOpen ? 'Close AI chat' : 'Open AI chat'}
              </TooltipContent>
            </Tooltip>
          </header>

          {/* Main content with optional chat panel */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto p-6">
              <div className="mx-auto max-w-6xl">
                <Outlet />
              </div>
            </main>

            {/* Chat Panel */}
            {chatOpen && (
              <div className="w-[400px] border-l bg-background">
                <ChatPanel
                  projectId={projectId}
                  className="h-full rounded-none border-0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
