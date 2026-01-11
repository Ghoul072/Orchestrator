import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'
import { ProjectCard } from './project-card'
import { CreateProjectDialog } from './create-project-dialog'
import { Skeleton } from '~/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { projectsQueryOptions } from '~/queries/projects'
import { updateProject, deleteProject } from '~/server/functions/projects'
import type { Project } from '~/server/db/schema'

export function ProjectsList() {
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const { data: projects, isLoading, error } = useQuery(projectsQueryOptions())

  const archiveMutation = useMutation({
    mutationFn: (project: Project) =>
      updateProject({
        data: { id: project.id, isArchived: !project.isArchived },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    },
  })

  const handleArchive = (project: Project) => {
    archiveMutation.mutate(project)
  }

  const handleDelete = (project: Project) => {
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id)
    }
  }

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
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action
              cannot be undone and will delete all associated tasks, meetings, and
              documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
