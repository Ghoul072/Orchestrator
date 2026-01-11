import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Filter, LayoutList } from 'lucide-react'
import { tasksQueryOptions } from '~/queries/tasks'
import { projectQueryOptions } from '~/queries/projects'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_layout/projects/$projectId/tasks')({
  component: TasksPage,
})

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400',
  cancelled: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/15 text-gray-600',
  medium: 'bg-yellow-500/15 text-yellow-600',
  high: 'bg-orange-500/15 text-orange-600',
  urgent: 'bg-red-500/15 text-red-600',
}

function TasksPage() {
  const { projectId } = Route.useParams()

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: tasks, isLoading } = useQuery(
    tasksQueryOptions({ projectId, parentId: null })
  )

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          {project && (
            <p className="text-sm text-muted-foreground">{project.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <LayoutList className="mr-2 h-4 w-4" />
            List
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center">
            <LayoutList className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No tasks yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first task to get started
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id as string} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: Record<string, unknown> }) {
  const title = task.title as string
  const description = task.description as string | null
  const status = task.status as string
  const priority = task.priority as string

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            <Badge className={statusColors[status]} variant="outline">
              {status.replace('_', ' ')}
            </Badge>
            <Badge className={priorityColors[priority]} variant="outline">
              {priority}
            </Badge>
          </div>
          {description && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
