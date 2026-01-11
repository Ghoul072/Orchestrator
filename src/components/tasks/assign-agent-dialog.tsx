import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  RobotIcon,
  LightningIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ListChecksIcon,
  ClockIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import {
  getTaskContext,
  createSession,
  getActiveSessionByTask,
} from '~/server/functions/agent-sessions'

interface AssignAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskTitle: string
  onAgentStarted?: (sessionId: string) => void
}

export function AssignAgentDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  onAgentStarted,
}: AssignAgentDialogProps) {
  const queryClient = useQueryClient()
  const [maxTurns, setMaxTurns] = useState(50)

  // Check for existing active session
  const { data: activeSession, isLoading: checkingSession } = useQuery({
    queryKey: ['agent-session', 'active', taskId],
    queryFn: () => getActiveSessionByTask({ data: { taskId } }),
    enabled: open,
  })

  // Get task context
  const { data: taskContext, isLoading: loadingContext } = useQuery({
    queryKey: ['task-context', taskId],
    queryFn: () => getTaskContext({ data: { taskId } }),
    enabled: open,
  })

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: () => createSession({ data: { taskId, maxTurns } }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['agent-session', taskId] })
      onOpenChange(false)
      onAgentStarted?.(session.id)
    },
  })

  const isLoading = checkingSession || loadingContext
  const hasActiveSession = Boolean(activeSession)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RobotIcon className="h-5 w-5" />
            Assign to Agent
          </DialogTitle>
          <DialogDescription>
            Review the task context before starting the agent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotchIcon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasActiveSession ? (
          <div className="py-8 text-center">
            <WarningCircleIcon className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h3 className="text-lg font-medium">Agent Already Active</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This task already has an active agent session. Please wait for it
              to complete or stop it before starting a new one.
            </p>
          </div>
        ) : (
          <>
            {/* Task Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">Task</h3>
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="font-medium">{taskTitle}</div>
                  {taskContext?.task.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {taskContext.task.description.replace(/<[^>]*>/g, '')}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {taskContext?.task.priority} priority
                    </Badge>
                    {taskContext?.task.effort && (
                      <Badge variant="outline">{taskContext.task.effort} effort</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Acceptance Criteria */}
              {taskContext?.task.acceptanceCriteria &&
                taskContext.task.acceptanceCriteria.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <ListChecksIcon className="h-4 w-4" />
                      Acceptance Criteria
                    </h3>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <ul className="space-y-1 text-sm">
                        {taskContext.task.acceptanceCriteria.map((criterion: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

              {/* Subtasks */}
              {taskContext?.subtasks && taskContext.subtasks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Subtasks</h3>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <ul className="space-y-1 text-sm">
                      {taskContext.subtasks.map((subtask: { id: string; title: string; status: string }) => (
                        <li key={subtask.id} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-5 w-5 justify-center p-0 text-xs',
                              subtask.status === 'completed' &&
                                'bg-green-500/10 text-green-600',
                              subtask.status === 'in_progress' &&
                                'bg-blue-500/10 text-blue-600'
                            )}
                          >
                            {subtask.status === 'completed'
                              ? '✓'
                              : subtask.status === 'in_progress'
                                ? '~'
                                : '○'}
                          </Badge>
                          <span>{subtask.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Context Preview */}
              <div>
                <h3 className="mb-2 text-sm font-medium">Agent Context</h3>
                <ScrollArea className="h-32 rounded-md border bg-muted/30 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                    {taskContext?.contextPrompt}
                  </pre>
                </ScrollArea>
              </div>

              {/* Max Turns */}
              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Max Turns</div>
                    <div className="text-xs text-muted-foreground">
                      Limit the number of agent turns
                    </div>
                  </div>
                </div>
                <select
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  className="rounded-md border bg-background px-3 py-1 text-sm"
                >
                  <option value={25}>25 turns</option>
                  <option value={50}>50 turns</option>
                  <option value={100}>100 turns</option>
                  <option value={150}>150 turns</option>
                  <option value={200}>200 turns</option>
                </select>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={isLoading || hasActiveSession || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <LightningIcon className="mr-2 h-4 w-4" weight="fill" />
                Start Agent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
