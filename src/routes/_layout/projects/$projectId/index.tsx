import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { projectWithTagsQueryOptions, projectStatsQueryOptions } from '~/queries/projects'
import { Skeleton } from '~/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'

export const Route = createFileRoute('/_layout/projects/$projectId/')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()

  const { data: project, isLoading: projectLoading } = useQuery(
    projectWithTagsQueryOptions(projectId)
  )

  const { data: stats, isLoading: statsLoading } = useQuery(
    projectStatsQueryOptions(projectId)
  )

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-96" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>
          <p className="text-muted-foreground">
            The project you're looking for doesn't exist.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.isArchived && (
            <Badge variant="secondary">Archived</Badge>
          )}
        </div>
        {project.description && (
          <p className="mt-2 text-muted-foreground">{project.description}</p>
        )}
        {project.tags.length > 0 && (
          <div className="mt-3 flex gap-2">
            {project.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{ borderColor: tag.color ?? undefined }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Tasks"
            value={stats.total_tasks}
            icon={ListTodo}
            iconColor="text-primary"
          />
          <StatCard
            title="Completed"
            value={stats.completed_tasks}
            icon={CheckCircle2}
            iconColor="text-green-500"
          />
          <StatCard
            title="In Progress"
            value={stats.in_progress_tasks}
            icon={Clock}
            iconColor="text-blue-500"
          />
          <StatCard
            title="Blocked"
            value={stats.blocked_tasks}
            icon={AlertCircle}
            iconColor="text-red-500"
          />
        </div>
      ) : null}

      {/* Recent Activity placeholder */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center">
            <p className="text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
