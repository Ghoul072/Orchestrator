import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import {
  Robot,
  CircleNotch,
  CheckCircle,
  XCircle,
  CaretDown,
  CaretRight,
  Stop,
  Play,
  Clock,
  Terminal,
  Warning,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import {
  getSession,
  getActiveSessionByTask,
  updateSessionStatus,
} from '~/server/functions/agent-sessions'

interface AgentProgressPanelProps {
  taskId: string
  sessionId?: string
  onSessionEnd?: () => void
  className?: string
}

interface ToolCall {
  id: string
  name: string
  input?: unknown
  result?: unknown
  status: 'pending' | 'running' | 'completed' | 'error'
  isError?: boolean
  startedAt?: number
  completedAt?: number
}

interface Step {
  id: string
  type: 'tool_use' | 'message' | 'thinking'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}

type SessionStatus =
  | 'queued'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'timeout'

const WS_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:3001/ws`
  : 'ws://localhost:3001/ws'

export function AgentProgressPanel({
  taskId,
  sessionId: providedSessionId,
  onSessionEnd,
  className,
}: AgentProgressPanelProps) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [steps, setSteps] = useState<Step[]>([])
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Get active session for this task
  const { data: activeSession } = useQuery({
    queryKey: ['agent-session', 'active', taskId],
    queryFn: () => getActiveSessionByTask({ data: { taskId } }),
    refetchInterval: 5000, // Poll for session updates
    enabled: !providedSessionId,
  })

  // Get session details
  const sessionId = providedSessionId || activeSession?.id
  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ['agent-session', sessionId],
    queryFn: () => getSession({ data: { id: sessionId! } }),
    enabled: !!sessionId,
    refetchInterval: isProcessing ? 2000 : false,
  })

  // Stop session mutation
  const stopMutation = useMutation({
    mutationFn: () => updateSessionStatus({
      data: {
        id: sessionId!,
        status: 'paused',
      },
    }),
    onSuccess: () => {
      toast.success('Agent session paused')
      void queryClient.invalidateQueries({ queryKey: ['agent-session'] })
    },
    onError: (error) => {
      toast.error('Failed to stop agent', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Connect to WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setWsStatus('connecting')
    const ws = new WebSocket(`${WS_URL}?taskId=${taskId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      console.log('[AgentProgressPanel] WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWsMessage(message)
      } catch (error) {
        console.error('[AgentProgressPanel] Failed to parse message:', error)
      }
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
      wsRef.current = null
    }

    ws.onerror = (error) => {
      console.error('[AgentProgressPanel] WebSocket error:', error)
      setWsStatus('disconnected')
    }
  }, [taskId])

  // Handle WebSocket messages
  const handleWsMessage = useCallback((message: {
    type: string
    content?: string
    toolCall?: ToolCall
    error?: string
    success?: boolean
    cost?: number
    duration?: number
  }) => {
    switch (message.type) {
      case 'connected':
        setIsProcessing(true)
        break

      case 'assistant_message':
        if (message.content) {
          setSteps((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              type: 'message',
              content: message.content as string,
              timestamp: Date.now(),
            },
          ])
        }
        break

      case 'tool_use_start':
        if (message.toolCall) {
          setCurrentToolCalls((prev) => [
            ...prev,
            { ...message.toolCall as ToolCall, status: 'running', startedAt: Date.now() },
          ])
        }
        break

      case 'tool_use_end':
        if (message.toolCall) {
          const tc = message.toolCall as ToolCall
          setCurrentToolCalls((prev) =>
            prev.map((t) =>
              t.id === tc.id
                ? { ...t, ...tc, status: 'completed', completedAt: Date.now() }
                : t
            )
          )

          // Move completed tool calls to steps
          setSteps((prev) => [
            ...prev,
            {
              id: `tool-${tc.id}`,
              type: 'tool_use',
              content: tc.name,
              toolCalls: [{ ...tc, status: 'completed' }],
              timestamp: Date.now(),
            },
          ])

          setCurrentToolCalls((prev) => prev.filter((t) => t.id !== tc.id))
        }
        break

      case 'result':
        setIsProcessing(false)
        void refetchSession()
        if (message.success) {
          onSessionEnd?.()
        }
        break

      case 'error':
        setIsProcessing(false)
        toast.error('Agent error', {
          description: message.error,
        })
        break
    }
  }, [onSessionEnd, refetchSession])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps, currentToolCalls])

  // Connect WebSocket when session is active
  useEffect(() => {
    if (sessionId && session?.status === 'executing' && wsStatus === 'disconnected') {
      connectWs()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [sessionId, session?.status, wsStatus, connectWs])

  if (!sessionId && !activeSession) {
    return null
  }

  const status = session?.status as SessionStatus | undefined

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Robot weight="duotone" className="h-5 w-5" />
          Agent Progress
        </CardTitle>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} isProcessing={isProcessing} />

          {status === 'executing' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="h-7"
            >
              <Stop weight="fill" className="mr-1 h-3 w-3" />
              Stop
            </Button>
          )}

          {status === 'paused' && (
            <Button
              size="sm"
              variant="outline"
              onClick={connectWs}
              className="h-7"
            >
              <Play weight="fill" className="mr-1 h-3 w-3" />
              Resume
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
          <div className="space-y-3">
            {/* Session info */}
            {session && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Turn</span>
                  <span>{session.currentTurn} / {session.maxTurns}</span>
                </div>
                {session.startedAt && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Started</span>
                    <span>{new Date(session.startedAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Completed steps */}
            {steps.map((step) => (
              <StepDisplay key={step.id} step={step} />
            ))}

            {/* Current tool calls */}
            {currentToolCalls.map((toolCall) => (
              <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
            ))}

            {/* Processing indicator */}
            {isProcessing && currentToolCalls.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleNotch className="h-4 w-4 animate-spin" />
                Agent is thinking...
              </div>
            )}

            {/* Empty state */}
            {steps.length === 0 && !isProcessing && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {status === 'queued' && 'Waiting to start...'}
                {status === 'planning' && 'Generating execution plan...'}
                {status === 'awaiting_approval' && 'Waiting for approval...'}
                {status === 'completed' && 'Session completed'}
                {status === 'failed' && 'Session failed'}
                {status === 'paused' && 'Session paused'}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Status badge component
function StatusBadge({
  status,
  isProcessing,
}: {
  status?: SessionStatus
  isProcessing: boolean
}) {
  if (isProcessing) {
    return (
      <Badge className="animate-pulse">
        <CircleNotch className="mr-1 h-3 w-3 animate-spin" />
        Processing
      </Badge>
    )
  }

  switch (status) {
    case 'queued':
      return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Queued</Badge>
    case 'planning':
      return <Badge variant="secondary"><CircleNotch className="mr-1 h-3 w-3 animate-spin" />Planning</Badge>
    case 'awaiting_approval':
      return <Badge variant="outline"><Warning className="mr-1 h-3 w-3" />Awaiting Approval</Badge>
    case 'executing':
      return <Badge><Terminal className="mr-1 h-3 w-3" />Executing</Badge>
    case 'paused':
      return <Badge variant="secondary">Paused</Badge>
    case 'completed':
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>
    case 'failed':
      return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>
    case 'timeout':
      return <Badge variant="destructive"><Clock className="mr-1 h-3 w-3" />Timeout</Badge>
    default:
      return <Badge variant="secondary">Unknown</Badge>
  }
}

// Step display component
function StepDisplay({ step }: { step: Step }) {
  if (step.type === 'message') {
    return (
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="whitespace-pre-wrap text-sm">{step.content}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {new Date(step.timestamp).toLocaleTimeString()}
        </div>
      </div>
    )
  }

  if (step.type === 'tool_use' && step.toolCalls?.[0]) {
    return <ToolCallDisplay toolCall={step.toolCalls[0]} />
  }

  return null
}

// Tool call display component
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-lg border bg-background text-sm">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50">
            {toolCall.status === 'running' ? (
              <CircleNotch className="h-4 w-4 animate-spin text-blue-500" />
            ) : toolCall.status === 'completed' && !toolCall.isError ? (
              <CheckCircle weight="fill" className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle weight="fill" className="h-4 w-4 text-red-500" />
            )}

            <span className="flex-1 font-mono text-xs">{toolCall.name}</span>

            {toolCall.completedAt && toolCall.startedAt && (
              <span className="text-xs text-muted-foreground">
                {((toolCall.completedAt - toolCall.startedAt) / 1000).toFixed(1)}s
              </span>
            )}

            {expanded ? (
              <CaretDown className="h-4 w-4" />
            ) : (
              <CaretRight className="h-4 w-4" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 py-2 space-y-2">
            {toolCall.input !== undefined && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Input
                </div>
                <pre className="overflow-auto rounded bg-muted p-2 text-xs max-h-32">
                  {typeof toolCall.input === 'string'
                    ? toolCall.input
                    : JSON.stringify(toolCall.input, null, 2)}
                </pre>
              </div>
            )}
            {toolCall.result !== undefined && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Result
                </div>
                <pre
                  className={cn(
                    'overflow-auto rounded p-2 text-xs max-h-32',
                    toolCall.isError ? 'bg-red-500/10' : 'bg-muted'
                  )}
                >
                  {typeof toolCall.result === 'string'
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
