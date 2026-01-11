import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks } from '@phosphor-icons/react'
import { tasksQueryOptions } from '~/queries/tasks'
import { projectQueryOptions } from '~/queries/projects'
import { createTask, updateTask } from '~/server/functions/tasks'
import { TaskBoard, type Task } from '~/components/tasks/task-board'
import { TaskEditor, type TaskFormData } from '~/components/tasks/task-editor'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_layout/projects/$projectId/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: tasks, isLoading } = useQuery(tasksQueryOptions({ projectId }))

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) =>
      createTask({
        data: {
          projectId,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          effort: data.effort,
          assignee: data.assignee,
          acceptanceCriteria: data.acceptanceCriteria,
          dueDate: data.dueDate,
          parentId: data.parentId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setEditorOpen(false)
    },
  })

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskFormData> }) =>
      updateTask({
        data: {
          id,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          effort: data.effort,
          assignee: data.assignee,
          acceptanceCriteria: data.acceptanceCriteria,
          dueDate: data.dueDate,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setEditorOpen(false)
      setEditingTask(null)
    },
  })

  // Transform tasks to the format expected by TaskBoard
  const boardTasks: Task[] = (tasks || []).map((task) => ({
    id: task.id as string,
    title: task.title as string,
    description: task.description as string | null,
    status: task.status as Task['status'],
    priority: task.priority as Task['priority'],
    effort: task.effort as Task['effort'],
    assignee: task.assignee as string | null,
    parentId: task.parentId as string | null,
    dueDate: task.dueDate ? new Date(task.dueDate as unknown as string) : null,
  }))

  const handleTaskClick = (taskId: string) => {
    const task = boardTasks.find((t) => t.id === taskId)
    if (task) {
      setEditingTask(task)
      setEditorOpen(true)
    }
  }

  const handleTaskStatusChange = (taskId: string, status: Task['status']) => {
    updateMutation.mutate({ id: taskId, data: { status } })
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    setEditorOpen(true)
  }

  const handleEditorSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Tasks</h1>
          {project && (
            <p className="text-sm text-muted-foreground">{project.name}</p>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <ListChecks className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No tasks yet</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Create your first task to get started with this project.
              </p>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </CardContent>
          </Card>
        </div>

        <TaskEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSubmit={handleEditorSubmit}
          isLoading={createMutation.isPending}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TaskBoard
        tasks={boardTasks}
        onTaskClick={handleTaskClick}
        onTaskStatusChange={handleTaskStatusChange}
        onCreateTask={handleCreateTask}
        className="flex-1"
      />

      <TaskEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditingTask(null)
        }}
        initialData={
          editingTask
            ? {
                title: editingTask.title,
                description: editingTask.description || undefined,
                status: editingTask.status,
                priority: editingTask.priority,
                effort: editingTask.effort || undefined,
                assignee: editingTask.assignee || undefined,
                acceptanceCriteria: [],
                dueDate: editingTask.dueDate
                  ? editingTask.dueDate.toISOString().split('T')[0]
                  : undefined,
              }
            : undefined
        }
        onSubmit={handleEditorSubmit}
        isEditing={!!editingTask}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
