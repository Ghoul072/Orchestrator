import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  FolderKanban,
  ListTodo,
  Settings,
  MessageSquare,
  FileText,
  GitBranch,
  Bot,
  Plus,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { CreateProjectDialog } from '~/components/projects/create-project-dialog'
import { projectQueryOptions } from '~/queries/projects'

interface SidebarProps {
  collapsed?: boolean
}

const mainNavItems = [
  { icon: FolderKanban, label: 'Projects', href: '/' as const },
]

export function Sidebar({ collapsed = false }: SidebarProps) {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  // Check if we're on a project page
  const projectMatch = currentPath.match(/^\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1]

  // Fetch project details when on project page
  const { data: project } = useQuery({
    ...projectQueryOptions(projectId || ''),
    enabled: !!projectId,
  })

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex h-full flex-col border-r bg-muted/40',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <FolderKanban className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold">Orchestrator</span>
            )}
          </Link>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {/* Main Navigation */}
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = currentPath === item.href
              const Icon = item.icon

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link to={item.href}>
                      <Button
                        variant={isActive ? 'secondary' : 'ghost'}
                        size="icon"
                        className="w-full"
                      >
                        <Icon className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Project Navigation (when on project page) */}
          {projectId && (
            <>
              <Separator className="my-4" />
              {!collapsed ? (
                <div className="mb-3 px-2">
                  <Link to="/" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-3 w-3" />
                    Back to Projects
                  </Link>
                  <h3 className="font-medium truncate" title={project?.name}>
                    {project?.name || 'Loading...'}
                  </h3>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/">
                      <Button variant="ghost" size="icon" className="mb-2 w-full">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Back to Projects</TooltipContent>
                </Tooltip>
              )}
              <div className="space-y-1">
                <ProjectNavItem
                  icon={ListTodo}
                  label="Tasks"
                  projectId={projectId}
                  segment="tasks"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
                <ProjectNavItem
                  icon={MessageSquare}
                  label="Meetings"
                  projectId={projectId}
                  segment="meetings"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
                <ProjectNavItem
                  icon={FileText}
                  label="Documents"
                  projectId={projectId}
                  segment="documents"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
                <ProjectNavItem
                  icon={GitBranch}
                  label="Repositories"
                  projectId={projectId}
                  segment="repositories"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
                <ProjectNavItem
                  icon={Bot}
                  label="Agents"
                  projectId={projectId}
                  segment="agents"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
                <ProjectNavItem
                  icon={Settings}
                  label="Settings"
                  projectId={projectId}
                  segment="settings"
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
              </div>
            </>
          )}
        </ScrollArea>

        {/* Bottom Section */}
        <div className="border-t p-3">
          <CreateProjectDialog
            trigger={
              collapsed ? (
                <Button variant="outline" size="icon" className="w-full" title="New Project">
                  <Plus className="h-5 w-5" />
                </Button>
              ) : (
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-5 w-5" />
                  New Project
                </Button>
              )
            }
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

function ProjectNavItem({
  icon: Icon,
  label,
  projectId,
  segment,
  currentPath,
  collapsed,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  projectId: string
  segment: string
  currentPath: string
  collapsed: boolean
}) {
  const href = `/projects/${projectId}/${segment}`
  const isActive =
    currentPath === href ||
    (segment === 'tasks' && currentPath === `/projects/${projectId}`)

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={href}>
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              size="icon"
              className="w-full"
            >
              <Icon className="h-5 w-5" />
            </Button>
          </a>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <a href={href}>
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        className="w-full justify-start gap-2"
      >
        <Icon className="h-5 w-5" />
        {label}
      </Button>
    </a>
  )
}
