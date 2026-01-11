import { useQuery } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'
import { ProjectCard } from './project-card'
import { CreateProjectDialog } from './create-project-dialog'
import { Skeleton } from '~/components/ui/skeleton'
import { projectsQueryOptions } from '~/queries/projects'

export function ProjectsList() {
  const { data: projects, isLoading, error } = useQuery(projectsQueryOptions())

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive">Failed to load projects</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No projects yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Create your first project to get started
        </p>
        <CreateProjectDialog />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
