import { useState, useMemo } from 'react'
import { TaskCard, type TaskCardProps } from './task-card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  ListIcon,
  SquaresFourIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { TaskFiltersPopover, ActiveFilters, type TaskFilters } from './task-filters'
import { cn } from '~/lib/utils'

type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
type ViewMode = 'list' | 'kanban'
type GroupBy = 'status' | 'priority' | 'none'

export interface Task extends Omit<TaskCardProps, 'onClick' | 'onStatusChange'> {
  parentId?: string | null
}

interface TaskBoardProps {
  tasks: Task[]
  onTaskClick?: (taskId: string) => void
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void
  onCreateTask?: () => void
  className?: string
}

const statusOrder: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled']
const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low']

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  completed: 'bg-green-500',
  cancelled: 'bg-gray-500',
}

export function TaskBoard({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onCreateTask,
  className,
}: TaskBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({
    statuses: [],
    priorities: [],
  })

  // Get unique assignees from tasks
  const assignees = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => {
      if (t.assignee) set.add(t.assignee)
    })
    return Array.from(set)
  }, [tasks])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      // Filter by status (if any selected)
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false
      }

      // Filter by priority (if any selected)
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false
      }

      // Filter by assignee
      if (filters.assignee && task.assignee !== filters.assignee) {
        return false
      }

      // Filter by due date
      if (filters.hasDueDate && !task.dueDate) {
        return false
      }

      // Filter completed (unless status filter includes completed)
      if (
        !showCompleted &&
        task.status === 'completed' &&
        !filters.statuses.includes('completed')
      ) {
        return false
      }

      // Only show root tasks (subtasks shown under their parent)
      if (task.parentId) {
        return false
      }

      return true
    })
  }, [tasks, searchQuery, showCompleted, filters])

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { all: filteredTasks }
    }

    const groups: Record<string, Task[]> = {}

    if (groupBy === 'status') {
      statusOrder.forEach((status) => {
        groups[status] = []
      })
    } else if (groupBy === 'priority') {
      priorityOrder.forEach((priority) => {
        groups[priority] = []
      })
    }

    filteredTasks.forEach((task) => {
      const key = groupBy === 'status' ? task.status : task.priority
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(task)
    })

    return groups
  }, [filteredTasks, groupBy])

  // Get subtasks for a task
  const getSubtasks = (parentId: string) => {
    return tasks.filter((t) => t.parentId === parentId)
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-b px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <TaskFiltersPopover
          filters={filters}
          onFiltersChange={setFilters}
          assignees={assignees}
        />

        {/* Group by */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group:</span>
          <div className="flex rounded-md border">
            <Button
              variant={groupBy === 'status' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setGroupBy('status')}
            >
              Status
            </Button>
            <Button
              variant={groupBy === 'priority' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setGroupBy('priority')}
            >
              Priority
            </Button>
            <Button
              variant={groupBy === 'none' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setGroupBy('none')}
            >
              None
            </Button>
          </div>
        </div>

        {/* View mode */}
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => setViewMode('list')}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => setViewMode('kanban')}
          >
            <SquaresFourIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Show completed toggle */}
        <Button
          variant={showCompleted ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? 'Hide' : 'Show'} Completed
        </Button>

        {/* Create task */}
        <Button size="sm" onClick={onCreateTask}>
          <PlusIcon className="mr-1 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Active filters */}
      <ActiveFilters
        filters={filters}
        onFiltersChange={setFilters}
        className="border-b px-4 py-2"
      />

      {/* Content */}
      {viewMode === 'list' ? (
        <ListView
          groupedTasks={groupedTasks}
          groupBy={groupBy}
          onTaskClick={onTaskClick}
          onTaskStatusChange={onTaskStatusChange}
          getSubtasks={getSubtasks}
        />
      ) : (
        <KanbanView
          groupedTasks={groupedTasks}
          groupBy={groupBy}
          onTaskClick={onTaskClick}
          onTaskStatusChange={onTaskStatusChange}
        />
      )}
    </div>
  )
}

// List view component
function ListView({
  groupedTasks,
  groupBy,
  onTaskClick,
  onTaskStatusChange,
  getSubtasks,
}: {
  groupedTasks: Record<string, Task[]>
  groupBy: GroupBy
  onTaskClick?: (taskId: string) => void
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void
  getSubtasks: (parentId: string) => Task[]
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {Object.entries(groupedTasks).map(([group, tasks]) => (
          <div key={group}>
            {groupBy !== 'none' && (
              <div className="mb-3 flex items-center gap-2">
                {groupBy === 'status' && (
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      statusColors[group as TaskStatus]
                    )}
                  />
                )}
                <h3 className="font-medium">
                  {groupBy === 'status'
                    ? statusLabels[group as TaskStatus]
                    : group.charAt(0).toUpperCase() + group.slice(1)}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {tasks.length}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              {tasks.map((task) => {
                const subtasks = getSubtasks(task.id)
                return (
                  <div key={task.id}>
                    <TaskCard
                      {...task}
                      onClick={() => onTaskClick?.(task.id)}
                      onStatusChange={(status) =>
                        onTaskStatusChange?.(task.id, status)
                      }
                      subtaskCount={subtasks.length}
                      completedSubtaskCount={
                        subtasks.filter((s) => s.status === 'completed').length
                      }
                    />
                    {/* Subtasks */}
                    {subtasks.length > 0 && (
                      <div className="ml-8 mt-1 space-y-1">
                        {subtasks.map((subtask) => (
                          <TaskCard
                            key={subtask.id}
                            {...subtask}
                            compact
                            onClick={() => onTaskClick?.(subtask.id)}
                            onStatusChange={(status) =>
                              onTaskStatusChange?.(subtask.id, status)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {tasks.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No tasks in this group
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// Kanban view component
function KanbanView({
  groupedTasks,
  groupBy,
  onTaskClick,
  onTaskStatusChange,
}: {
  groupedTasks: Record<string, Task[]>
  groupBy: GroupBy
  onTaskClick?: (taskId: string) => void
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void
}) {
  // For kanban, always group by status if not already
  const columns =
    groupBy === 'status'
      ? groupedTasks
      : Object.fromEntries(
          statusOrder.map((status) => [
            status,
            Object.values(groupedTasks)
              .flat()
              .filter((t) => t.status === status),
          ])
        )

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto p-4">
      {statusOrder.map((status) => {
        const tasks = columns[status] || []

        return (
          <div
            key={status}
            className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/30"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
              <div
                className={cn('h-2 w-2 rounded-full', statusColors[status])}
              />
              <h3 className="flex-1 font-medium text-sm">
                {statusLabels[status]}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {tasks.length}
              </Badge>
            </div>

            {/* Column content */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    {...task}
                    onClick={() => onTaskClick?.(task.id)}
                    onStatusChange={(newStatus) =>
                      onTaskStatusChange?.(task.id, newStatus)
                    }
                  />
                ))}

                {tasks.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No tasks
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}
