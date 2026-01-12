import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { tasksQueryOptions } from '~/queries/tasks'
import { projectQueryOptions } from '~/queries/projects'
import { repositoriesQueryOptions } from '~/queries/repositories'
import { createTask, updateTask } from '~/server/functions/tasks'
import { getGitHubTokenStatus, pushTaskToGitHub } from '~/server/functions/github'
import { getActiveSessions, createSession } from '~/server/functions/agent-sessions'
import { TaskBoard, type Task } from '~/components/tasks/task-board'
import { TaskEditor, type TaskFormData } from '~/components/tasks/task-editor'
import { AgentProgressPanel } from '~/components/tasks/agent-progress-panel'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'

export const Route = createFileRoute('/_layout/projects/$projectId/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [parentTaskId, setParentTaskId] = useState<string | null>(null)
  const [activeAgentTaskId, setActiveAgentTaskId] = useState<string | null>(null)
  const [repoFilter, setRepoFilter] = useState('all')

  const { data: project } = useQuery(projectQueryOptions(projectId))
  const { data: repositories } = useQuery(repositoriesQueryOptions(projectId))

  // Check for active agent sessions in this project
  const { data: activeSessions } = useQuery({
    queryKey: ['agent-sessions', 'active'],
    queryFn: () => getActiveSessions({}),
    refetchInterval: 10000, // Poll every 10s
  })

  // Get task IDs that have active sessions
  const tasksWithActiveSessions = new Set(
    (activeSessions || [])
      .filter((s) => ['queued', 'planning', 'executing', 'awaiting_approval'].includes(s.status))
      .map((s) => s.taskId)
  )

  const { data: tasks, isLoading } = useQuery(tasksQueryOptions({ projectId }))

  const { data: githubTokenStatus } = useQuery({
    queryKey: ['github-token-status'],
    queryFn: () => getGitHubTokenStatus(),
  })

  const pushToGitHubMutation = useMutation({
    mutationFn: (taskId: string) => pushTaskToGitHub({ data: { taskId } }),
    onSuccess: (result) => {
      toast.success(
        result.action === 'created'
          ? 'Task pushed to GitHub'
          : 'GitHub issue updated'
      )
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      toast.error('Failed to push to GitHub', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const task = await createTask({
        data: {
          projectId,
          repositoryId: data.repositoryId,
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
      })

      // If auto-assign agent is enabled, create a session
      if (data.autoAssignAgent && task?.id) {
        try {
          await createSession({ data: { taskId: task.id as string } })
          return { task, autoAssigned: true }
        } catch (error) {
          console.error('Failed to create agent session:', error)
          toast.error('Task created but failed to assign agent', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
          return { task, autoAssigned: false }
        }
      }
      return { task, autoAssigned: false }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] })
      setEditorOpen(false)

      // If auto-assigned, show the agent panel
      if (result.autoAssigned && result.task?.id) {
        setActiveAgentTaskId(result.task.id as string)
        toast.success('Task created and agent assigned', {
          description: 'Agent will start working on the task',
        })
      }
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
          repositoryId: data.repositoryId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setEditorOpen(false)
      setEditingTask(null)
    },
  })

  const repositoriesById = new Map(
    (repositories || []).map((repo) => [repo.id as string, repo])
  )

  const syncableRepoIds = new Set(
    (repositories || [])
      .filter((repo) => repo.githubSyncEnabled)
      .map((repo) => repo.id as string)
  )

  // Transform tasks to the format expected by TaskBoard
  const boardTasks: Task[] = (tasks || []).map((task) => {
    const hasActiveAgent = tasksWithActiveSessions.has(task.id as string)
    const repository = task.repositoryId
      ? repositoriesById.get(task.repositoryId as string)
      : null
    return {
      id: task.id as string,
      title: task.title as string,
      description: task.description as string | null,
      status: task.status as Task['status'],
      priority: task.priority as Task['priority'],
      effort: task.effort as Task['effort'],
      assignee: hasActiveAgent ? 'Agent' : (task.assignee as string | null),
      parentId: task.parentId as string | null,
      repositoryId: task.repositoryId as string | null,
      repositoryName: repository?.name ?? null,
      dueDate: task.dueDate ? new Date(task.dueDate as unknown as string) : null,
      githubIssueUrl: task.githubIssueUrl as string | null,
      githubEnabled:
        Boolean(githubTokenStatus?.available) &&
        Boolean(task.repositoryId && syncableRepoIds.has(task.repositoryId as string)),
    }
  })

  const hasUnassignedTasks = boardTasks.some((task) => !task.repositoryId)
  const repoTabs = [
    { id: 'all', label: 'All' },
    ...(repositories || []).map((repo) => ({ id: repo.id as string, label: repo.name })),
    ...(hasUnassignedTasks ? [{ id: 'unassigned', label: 'Unassigned' }] : []),
  ]

  const filteredBoardTasks = boardTasks.filter((task) => {
    if (repoFilter === 'all') return true
    if (repoFilter === 'unassigned') return !task.repositoryId
    return task.repositoryId === repoFilter
  })

  useEffect(() => {
    const validIds = new Set([
      'all',
      ...(hasUnassignedTasks ? ['unassigned'] : []),
      ...(repositories || []).map((repo) => repo.id as string),
    ])
    if (!validIds.has(repoFilter)) {
      setRepoFilter('all')
    }
  }, [hasUnassignedTasks, repositories, repoFilter])

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
    setParentTaskId(null)
    setEditorOpen(true)
  }

  const handleAddSubtask = (parentId: string) => {
    setEditingTask(null)
    setParentTaskId(parentId)
    setEditorOpen(true)
  }

  const handleEditorSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handlePushToGitHub = (taskId: string) => {
    pushToGitHubMutation.mutate(taskId)
  }

  if (!isLoading && (!tasks || tasks.length === 0)) {
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
          repositories={(repositories || []).map((repo) => ({
            id: repo.id as string,
            name: repo.name as string,
          }))}
        />
      </div>
    )
  }

  // Find the active task's title for the panel
  const activeAgentTask = activeAgentTaskId
    ? boardTasks.find((t) => t.id === activeAgentTaskId)
    : null

  return (
    <div className="flex h-full">
      {/* Main task board */}
      <div className="flex flex-1 flex-col">
        {repoTabs.length > 1 && (
          <div className="border-b px-4 py-3">
            <Tabs value={repoFilter} onValueChange={setRepoFilter}>
              <TabsList className="flex-wrap">
                {repoTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
        <TaskBoard
          tasks={filteredBoardTasks}
          onTaskClick={handleTaskClick}
          onTaskStatusChange={handleTaskStatusChange}
          onPushToGitHub={githubTokenStatus?.available ? handlePushToGitHub : undefined}
          onAddSubtask={handleAddSubtask}
          onCreateTask={handleCreateTask}
          className="flex-1"
          isLoading={isLoading}
        />
      </div>

      {/* Agent progress panel (slide-out when active) */}
      {activeAgentTaskId && (
        <div className="w-96 border-l flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-sm font-medium truncate">
                {activeAgentTask?.title || 'Agent Task'}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setActiveAgentTaskId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <AgentProgressPanel
            taskId={activeAgentTaskId}
            taskTitle={activeAgentTask?.title}
            onSessionEnd={() => {
              queryClient.invalidateQueries({ queryKey: ['tasks'] })
            }}
            className="flex-1 border-0 rounded-none"
          />
        </div>
      )}

      <TaskEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditingTask(null)
            setParentTaskId(null)
          }
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
                repositoryId: editingTask.repositoryId ?? null,
              }
            : parentTaskId
              ? { parentId: parentTaskId }
              : undefined
        }
        onSubmit={handleEditorSubmit}
        isEditing={!!editingTask}
        isLoading={createMutation.isPending || updateMutation.isPending}
        repositories={(repositories || []).map((repo) => ({
          id: repo.id as string,
          name: repo.name as string,
        }))}
        parentTaskTitle={
          parentTaskId
            ? boardTasks.find((t) => t.id === parentTaskId)?.title
            : undefined
        }
      />
    </div>
  )
}
