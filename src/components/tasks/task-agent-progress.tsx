import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  RobotIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  StopIcon,
  CodeIcon,
  CaretDownIcon,
  CaretRightIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import { useTaskAgent } from '~/lib/use-task-agent'
import { activeSessionByTaskQueryOptions } from '~/queries/agent-sessions'
import { getTaskContext } from '~/server/functions/agent-sessions'
import type { Message, ToolCall } from '~/lib/use-agent'

// Helper to format tool result for display
function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) {
    return ''
  }
  if (typeof result === 'string') {
    return result.length > 500 ? result.slice(0, 500) + '...' : result
  }
  const jsonStr = JSON.stringify(result, null, 2)
  return jsonStr.length > 500 ? jsonStr.slice(0, 500) + '...' : jsonStr
}

interface TaskAgentProgressProps {
  taskId: string
  taskTitle: string
  projectId?: string
  workingDirectory?: string
  onComplete?: (success: boolean) => void
}

export function TaskAgentProgress({
  taskId,
  taskTitle,
  projectId,
  workingDirectory = '/tmp',
  onComplete,
}: TaskAgentProgressProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  // Check for active session
  const { data: activeSession } = useQuery(activeSessionByTaskQueryOptions(taskId))

  // Get task context for the initial prompt
  const { data: taskContext } = useQuery({
    queryKey: ['task-context', taskId],
    queryFn: () => getTaskContext({ data: { taskId } }),
    enabled: Boolean(activeSession),
  })

  // Use task agent hook when we have an active session
  const agent = useTaskAgent({
    sessionId: activeSession?.id || '',
    taskId,
    projectId,
    workingDirectory,
    onComplete,
    onError: (error) => console.error('[TaskAgentProgress]', error),
  })

  // Start the agent when we have both session and context
  useEffect(() => {
    if (activeSession && taskContext?.contextPrompt && !agent.isRunning) {
      agent.start(taskContext.contextPrompt)
    }
  }, [activeSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleToolExpanded = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  if (!activeSession) {
    return null
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RobotIcon className="h-5 w-5" />
            Agent Working on Task
          </CardTitle>
          <div className="flex items-center gap-2">
            {agent.isRunning ? (
              <>
                <Badge variant="secondary" className="gap-1">
                  <CircleNotchIcon className="h-3 w-3 animate-spin" />
                  Turn {agent.progress.turnNumber}
                </Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={agent.stop}
                >
                  <StopIcon className="mr-1 h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : agent.progress.isComplete ? (
              <Badge
                variant={agent.progress.errorMessage ? 'destructive' : 'default'}
                className="gap-1"
              >
                {agent.progress.errorMessage ? (
                  <>
                    <XCircleIcon className="h-3 w-3" />
                    Failed
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-3 w-3" />
                    Completed
                  </>
                )}
              </Badge>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => taskContext?.contextPrompt && agent.start(taskContext.contextPrompt)}
              >
                <PlayIcon className="mr-1 h-4 w-4" />
                Start
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{taskTitle}</p>
      </CardHeader>

      <CardContent>
        {/* Progress Stats */}
        <div className="mb-4 flex flex-wrap gap-2">
          {agent.progress.toolsUsed.map((tool) => (
            <Badge key={tool} variant="outline" className="text-xs">
              <CodeIcon className="mr-1 h-3 w-3" />
              {tool}
            </Badge>
          ))}
        </div>

        {/* Current Activity */}
        {agent.progress.currentTool && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <CircleNotchIcon className="h-4 w-4 animate-spin text-primary" />
            <span>Running {agent.progress.currentTool}...</span>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-3">
          <div className="space-y-3">
            {agent.messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                expandedTools={expandedTools}
                onToggleTool={toggleToolExpanded}
              />
            ))}

            {agent.messages.length === 0 && !agent.isRunning && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Agent has not started yet.
              </div>
            )}

            {agent.isRunning && agent.messages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <CircleNotchIcon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error Message */}
        {agent.progress.errorMessage && (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {agent.progress.errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Message item component
function MessageItem({
  message,
  expandedTools,
  onToggleTool,
}: {
  message: Message
  expandedTools: Set<string>
  onToggleTool: (id: string) => void
}) {
  if (message.role === 'assistant') {
    return (
      <div className="space-y-2">
        {message.content && (
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        )}

        {message.toolCalls?.map((tool) => (
          <ToolCallItem
            key={tool.id}
            tool={tool}
            expanded={expandedTools.has(tool.id)}
            onToggle={() => onToggleTool(tool.id)}
          />
        ))}
      </div>
    )
  }

  return null
}

// Tool call item component
function ToolCallItem({
  tool,
  expanded,
  onToggle,
}: {
  tool: ToolCall
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-md border bg-background">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
      >
        {expanded ? (
          <CaretDownIcon className="h-3 w-3" />
        ) : (
          <CaretRightIcon className="h-3 w-3" />
        )}
        <CodeIcon className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{tool.name}</span>
        <span
          className={cn(
            'ml-auto h-2 w-2 rounded-full',
            tool.status === 'running' && 'animate-pulse bg-blue-500',
            tool.status === 'completed' && 'bg-green-500',
            tool.status === 'error' && 'bg-red-500'
          )}
        />
      </button>

      {expanded && (
        <div className="border-t px-3 py-2">
          {tool.input !== undefined && (
            <div className="mb-2">
              <div className="text-xs font-medium text-muted-foreground">Input</div>
              <pre className="mt-1 overflow-x-auto text-xs">
                {formatToolResult(tool.input)}
              </pre>
            </div>
          )}

          {tool.result !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Result</div>
              <pre className="mt-1 max-h-32 overflow-auto text-xs">
                {formatToolResult(tool.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
