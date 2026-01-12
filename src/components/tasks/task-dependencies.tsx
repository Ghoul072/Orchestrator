import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  ArrowsLeftRightIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  CircleIcon,
  ProhibitIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import {
  getTaskRelations,
  addTaskRelation,
  removeTaskRelation,
} from '~/server/functions/tasks'
import { allTasksInProjectQueryOptions } from '~/queries/tasks'

interface TaskDependenciesProps {
  taskId: string
  projectId: string
  className?: string
}

type RelationType = 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates'

const relationTypeConfig: Record<RelationType, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}> = {
  blocks: {
    label: 'Blocks',
    icon: ArrowRightIcon,
    color: 'text-red-500',
    description: 'This task blocks another task',
  },
  blocked_by: {
    label: 'Blocked by',
    icon: ArrowLeftIcon,
    color: 'text-orange-500',
    description: 'This task is blocked by another task',
  },
  relates_to: {
    label: 'Related to',
    icon: LinkIcon,
    color: 'text-blue-500',
    description: 'This task is related to another task',
  },
  duplicates: {
    label: 'Duplicates',
    icon: ArrowsLeftRightIcon,
    color: 'text-purple-500',
    description: 'This task duplicates another task',
  },
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <CircleIcon className="h-3 w-3 text-muted-foreground" />,
  in_progress: <CircleIcon className="h-3 w-3 text-blue-500" weight="fill" />,
  blocked: <ProhibitIcon className="h-3 w-3 text-red-500" weight="fill" />,
  completed: <CheckCircleIcon className="h-3 w-3 text-green-500" weight="fill" />,
  cancelled: <ProhibitIcon className="h-3 w-3 text-muted-foreground" weight="fill" />,
}

export function TaskDependencies({
  taskId,
  projectId,
  className,
}: TaskDependenciesProps) {
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>('blocked_by')

  // Fetch relations for this task
  const { data: relations = { outgoing: [], incoming: [] } } = useQuery({
    queryKey: ['task-relations', taskId],
    queryFn: () => getTaskRelations({ data: { id: taskId } }),
  })

  // Fetch all tasks in project for the picker
  const { data: projectTasks = [] } = useQuery(allTasksInProjectQueryOptions(projectId))

  // Filter out current task and already related tasks
  const availableTasks = useMemo(() => {
    const relatedTaskIds = new Set([
      ...relations.outgoing.map((r) => r.targetTaskId),
      ...relations.incoming.map((r) => r.sourceTaskId),
      taskId,
    ])
    return projectTasks.filter((t) => !relatedTaskIds.has(t.id))
  }, [projectTasks, relations, taskId])

  // Add relation mutation
  const addMutation = useMutation({
    mutationFn: (data: { sourceTaskId: string; targetTaskId: string; relationType: RelationType }) =>
      addTaskRelation({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setIsAddDialogOpen(false)
      setSelectedTaskId('')
    },
  })

  // Remove relation mutation
  const removeMutation = useMutation({
    mutationFn: (relationId: string) =>
      removeTaskRelation({ data: { id: relationId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })

  const handleAddRelation = () => {
    if (!selectedTaskId) return

    const sourceTaskId = selectedRelationType === 'blocked_by' ? selectedTaskId : taskId
    const targetTaskId = selectedRelationType === 'blocked_by' ? taskId : selectedTaskId
    const relationType = selectedRelationType === 'blocked_by' ? 'blocks' : selectedRelationType

    addMutation.mutate({
      sourceTaskId,
      targetTaskId,
      relationType,
    })
  }

  // Combine relations for display
  const allRelations = useMemo(() => {
    const result: Array<{
      id: string
      type: RelationType
      direction: 'outgoing' | 'incoming'
      relatedTask: { id: string; title: string; status: string }
    }> = []

    // Outgoing relations (this task -> other task)
    for (const rel of relations.outgoing) {
      const relatedTask = projectTasks.find((t) => t.id === rel.targetTaskId)
      if (relatedTask) {
        result.push({
          id: rel.id,
          type: rel.relationType,
          direction: 'outgoing',
          relatedTask: {
            id: relatedTask.id,
            title: relatedTask.title,
            status: relatedTask.status,
          },
        })
      }
    }

    // Incoming relations (other task -> this task)
    for (const rel of relations.incoming) {
      const relatedTask = projectTasks.find((t) => t.id === rel.sourceTaskId)
      if (relatedTask) {
        // Convert to opposite direction
        const displayType: RelationType =
          rel.relationType === 'blocks' ? 'blocked_by' :
          rel.relationType === 'blocked_by' ? 'blocks' :
          rel.relationType
        result.push({
          id: rel.id,
          type: displayType,
          direction: 'incoming',
          relatedTask: {
            id: relatedTask.id,
            title: relatedTask.title,
            status: relatedTask.status,
          },
        })
      }
    }

    return result
  }, [relations, projectTasks])

  const blockers = allRelations.filter((r) => r.type === 'blocked_by')
  const blocks = allRelations.filter((r) => r.type === 'blocks')
  const related = allRelations.filter((r) => r.type === 'relates_to' || r.type === 'duplicates')

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Dependencies</h4>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Dependency</DialogTitle>
              <DialogDescription>
                Link this task to another task in the project.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Relationship Type</label>
                <Select
                  value={selectedRelationType}
                  onValueChange={(value) => setSelectedRelationType(value as RelationType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(relationTypeConfig).map(([key, config]) => {
                      const Icon = config.icon
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', config.color)} />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {relationTypeConfig[selectedRelationType].description}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Related Task</label>
                <Select
                  value={selectedTaskId}
                  onValueChange={setSelectedTaskId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      {availableTasks.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No tasks available
                        </div>
                      ) : (
                        availableTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            <div className="flex items-center gap-2">
                              {statusIcons[task.status]}
                              <span className="truncate">{task.title}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRelation}
                disabled={!selectedTaskId || addMutation.isPending}
              >
                {addMutation.isPending ? 'Adding...' : 'Add Dependency'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* No dependencies message */}
      {allRelations.length === 0 && (
        <div className="rounded-md border border-dashed py-6 text-center">
          <LinkIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No dependencies yet
          </p>
        </div>
      )}

      {/* Blockers section */}
      {blockers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="font-medium">Blocked by ({blockers.length})</span>
          </div>
          <div className="space-y-1">
            {blockers.map((rel) => (
              <RelationItem
                key={rel.id}
                relation={rel}
                onRemove={() => removeMutation.mutate(rel.id)}
                isLoading={removeMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Blocks section */}
      {blocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <ArrowRightIcon className="h-4 w-4" />
            <span className="font-medium">Blocks ({blocks.length})</span>
          </div>
          <div className="space-y-1">
            {blocks.map((rel) => (
              <RelationItem
                key={rel.id}
                relation={rel}
                onRemove={() => removeMutation.mutate(rel.id)}
                isLoading={removeMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Related section */}
      {related.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <LinkIcon className="h-4 w-4" />
            <span className="font-medium">Related ({related.length})</span>
          </div>
          <div className="space-y-1">
            {related.map((rel) => (
              <RelationItem
                key={rel.id}
                relation={rel}
                onRemove={() => removeMutation.mutate(rel.id)}
                isLoading={removeMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RelationItem({
  relation,
  onRemove,
  isLoading,
}: {
  relation: {
    id: string
    type: RelationType
    relatedTask: { id: string; title: string; status: string }
  }
  onRemove: () => void
  isLoading: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        {statusIcons[relation.relatedTask.status]}
        <span className="text-sm">{relation.relatedTask.title}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onRemove}
        disabled={isLoading}
      >
        <TrashIcon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  )
}
