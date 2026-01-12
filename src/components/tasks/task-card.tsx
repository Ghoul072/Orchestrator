import { useState } from 'react'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  CheckCircle,
  Circle,
  Clock,
  DotsThree,
  Flag,
  ListChecks,
  Prohibit,
  User,
  CaretDown,
  CaretRight,
  Robot,
  Pencil,
  Trash,
  Archive,
  GithubLogo,
  ArrowSquareOut,
  Plus,
} from '@phosphor-icons/react'
import { cn, stripHtml } from '~/lib/utils'
import { AssignAgentDialog } from './assign-agent-dialog'

// Task status and priority types from schema
type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
type TaskEffort = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface TaskCardProps {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  effort?: TaskEffort | null
  assignee?: string | null
  repositoryName?: string | null
  subtaskCount?: number
  completedSubtaskCount?: number
  dueDate?: Date | null
  githubIssueUrl?: string | null
  githubEnabled?: boolean
  onClick?: () => void
  onStatusChange?: (status: TaskStatus) => void
  onEdit?: () => void
  onDelete?: () => void
  onArchive?: () => void
  onPushToGitHub?: () => void
  onAddSubtask?: () => void
  onAgentStarted?: (sessionId: string) => void
  className?: string
  compact?: boolean
}

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" weight="fill" />,
  blocked: <Prohibit className="h-4 w-4 text-red-500" weight="fill" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />,
  cancelled: <Prohibit className="h-4 w-4 text-muted-foreground" weight="fill" />,
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-slate-500/10 text-slate-500',
  medium: 'bg-blue-500/10 text-blue-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
}

const effortLabels: Record<TaskEffort, string> = {
  xs: 'XS',
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
}

export function TaskCard({
  id,
  title,
  description,
  status,
  priority,
  effort,
  assignee,
  repositoryName,
  subtaskCount = 0,
  completedSubtaskCount = 0,
  dueDate,
  githubIssueUrl,
  githubEnabled,
  onClick,
  onStatusChange,
  onEdit,
  onDelete,
  onArchive,
  onPushToGitHub,
  onAddSubtask,
  onAgentStarted,
  className,
  compact = false,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Cycle through statuses
    const statusOrder: TaskStatus[] = ['pending', 'in_progress', 'completed']
    const currentIndex = statusOrder.indexOf(status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    onStatusChange?.(nextStatus)
  }

  if (compact) {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted/50',
          status === 'completed' && 'opacity-60',
          className
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        <button
          onClick={handleStatusClick}
          className="flex-shrink-0 hover:scale-110 transition-transform"
        >
          {statusIcons[status]}
        </button>

        <span
          className={cn(
            'flex-1 truncate text-sm',
            status === 'completed' && 'line-through'
          )}
        >
          {title}
        </span>

        {priority !== 'medium' && (
          <Badge variant="secondary" className={cn('text-xs', priorityColors[priority])}>
            <Flag weight="fill" className="mr-1 h-3 w-3" />
            {priority}
          </Badge>
        )}

        {subtaskCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedSubtaskCount}/{subtaskCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md',
        status === 'completed' && 'opacity-70',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4 pb-2">
        <button
          onClick={handleStatusClick}
          className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
        >
          {statusIcons[status]}
        </button>

        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              'font-medium leading-tight',
              status === 'completed' && 'line-through text-muted-foreground'
            )}
          >
            {title}
          </h4>

          {description && !expanded && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {stripHtml(description)}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <DotsThree className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setAssignDialogOpen(true)
              }}
            >
              <Robot className="mr-2 h-4 w-4" />
              Assign to Agent
            </DropdownMenuItem>
            {githubEnabled && onPushToGitHub && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onPushToGitHub()
                }}
              >
                <GithubLogo className="mr-2 h-4 w-4" />
                {githubIssueUrl ? 'Update GitHub Issue' : 'Push to GitHub'}
              </DropdownMenuItem>
            )}
            {githubIssueUrl && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(githubIssueUrl, '_blank')
                }}
              >
                <ArrowSquareOut className="mr-2 h-4 w-4" />
                View on GitHub
              </DropdownMenuItem>
            )}
            {onAddSubtask && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onAddSubtask()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Subtask
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onEdit && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive()
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Expanded description */}
        {description && expanded && (
          <p className="mb-3 text-sm text-muted-foreground whitespace-pre-wrap">
            {stripHtml(description)}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2">
          {repositoryName && (
            <Badge variant="outline" className="text-xs">
              {repositoryName}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={cn('text-xs', priorityColors[priority])}
          >
            <Flag weight="fill" className="mr-1 h-3 w-3" />
            {priority}
          </Badge>

          {effort && (
            <Badge variant="outline" className="text-xs">
              {effortLabels[effort]}
            </Badge>
          )}

          {subtaskCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <ListChecks className="mr-1 h-3 w-3" />
              {completedSubtaskCount}/{subtaskCount}
            </Badge>
          )}

          {assignee && (
            <Badge variant="outline" className="text-xs">
              <User className="mr-1 h-3 w-3" />
              {assignee}
            </Badge>
          )}

          {dueDate && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                new Date(dueDate) < new Date() && status !== 'completed'
                  ? 'border-red-500 text-red-500'
                  : ''
              )}
            >
              <Clock className="mr-1 h-3 w-3" />
              {new Date(dueDate).toLocaleDateString()}
            </Badge>
          )}

          {githubIssueUrl && (
            <a
              href={githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <Badge variant="outline" className="text-xs hover:bg-muted">
                <GithubLogo className="mr-1 h-3 w-3" />
                Issue
              </Badge>
            </a>
          )}
        </div>

        {/* Expand toggle for description */}
        {description && stripHtml(description).length > 100 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                <CaretDown className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <CaretRight className="h-3 w-3" />
                Show more
              </>
            )}
          </button>
        )}
      </CardContent>

      {/* Assign Agent Dialog */}
      <AssignAgentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        taskId={id}
        taskTitle={title}
        onAgentStarted={onAgentStarted}
      />
    </Card>
  )
}
