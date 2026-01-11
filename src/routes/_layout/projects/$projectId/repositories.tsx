import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from '@phosphor-icons/react'
import { repositoriesQueryOptions } from '~/queries/repositories'
import { projectQueryOptions } from '~/queries/projects'
import {
  createRepository,
  deleteRepository,
  cloneRepository,
  cleanupRepository,
} from '~/server/functions/repos'
import { RepositoryList } from '~/components/repositories/repository-list'
import { AddRepositoryDialog } from '~/components/repositories/add-repository-dialog'
import { Button } from '~/components/ui/button'
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

export const Route = createFileRoute('/_layout/projects/$projectId/repositories')({
  component: RepositoriesPage,
})

function RepositoriesPage() {
  const params = Route.useParams() as { projectId: string }
  const projectId = params.projectId
  const queryClient = useQueryClient()

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [repoToDelete, setRepoToDelete] = useState<string | null>(null)

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: repositories, isLoading } = useQuery(repositoriesQueryOptions(projectId))

  const createMutation = useMutation({
    mutationFn: (data: { url: string; name: string; branch: string }) =>
      createRepository({
        data: {
          projectId,
          url: data.url,
          name: data.name,
          branch: data.branch,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] })
      setAddDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRepository({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] })
      setDeleteDialogOpen(false)
      setRepoToDelete(null)
    },
  })

  const cloneMutation = useMutation({
    mutationFn: (id: string) => cloneRepository({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] })
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: (id: string) => cleanupRepository({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] })
    },
  })

  const handleDelete = (id: string) => {
    setRepoToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (repoToDelete) {
      deleteMutation.mutate(repoToDelete)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
          {project && <p className="text-sm text-muted-foreground">{project.name}</p>}
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <RepositoryList
        repositories={(repositories || []).map((r: {
          id: string;
          name: string;
          url: string;
          branch: string | null;
          cloneStatus: string;
          stack: string[] | null;
          lastClonedAt: Date | null;
        }) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          branch: r.branch,
          cloneStatus: r.cloneStatus as 'pending' | 'cloning' | 'cloned' | 'analyzing' | 'ready' | 'failed' | 'cleaned',
          stack: r.stack,
          lastClonedAt: r.lastClonedAt,
        }))}
        onAddRepository={() => setAddDialogOpen(true)}
        onDeleteRepository={handleDelete}
        onCloneRepository={(id) => cloneMutation.mutate(id)}
        onCleanupRepository={(id) => cleanupMutation.mutate(id)}
        isCloning={cloneMutation.isPending}
      />
      )}

      <AddRepositoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Repository</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this repository? This will not delete the actual
              repository, only unlink it from this project.
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
    </div>
  )
}
