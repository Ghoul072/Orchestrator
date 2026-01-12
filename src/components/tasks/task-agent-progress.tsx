import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Textarea } from '~/components/ui/textarea'
import {
  RobotIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  CodeIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  PencilSimpleIcon,
  WarningIcon,
  ClockIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import { useTaskAgent, type TaskAgentStatus, type ToolUse, type ProgressMessage } from '~/lib/use-task-agent'
import { activeSessionByTaskQueryOptions } from '~/queries/agent-sessions'
import type { ExecutionPlan } from '~/server/db/schema'

interface TaskAgentProgressProps {
  taskId: string
  taskTitle: string
  onComplete?: (success: boolean) => void
}

export function TaskAgentProgress({
  taskId,
  taskTitle,
  onComplete,
}: TaskAgentProgressProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [feedbackText, setFeedbackText] = useState('')
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)

  // Check for active session
  const { data: activeSession, refetch: refetchSession } = useQuery(activeSessionByTaskQueryOptions(taskId))

  // Use task agent hook when we have an active session
  const agent = useTaskAgent({
    sessionId: activeSession?.id || '',
    autoConnect: Boolean(activeSession?.id),
    onPlanReady: (plan) => {
      console.log('[TaskAgentProgress] Plan ready:', plan)
    },
    onStatusChange: (status) => {
      console.log('[TaskAgentProgress] Status changed:', status)
      if (status === 'completed' || status === 'failed') {
        refetchSession()
      }
    },
    onComplete,
    onError: (error) => console.error('[TaskAgentProgress]', error),
  })

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

  const handleApprovePlan = () => {
    agent.approvePlan()
    setShowFeedbackInput(false)
    setFeedbackText('')
  }

  const handleRequestChanges = () => {
    if (feedbackText.trim()) {
      agent.requestChanges(feedbackText.trim())
      setShowFeedbackInput(false)
      setFeedbackText('')
    }
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
            <StatusBadge status={agent.status} currentTurn={agent.currentTurn} />
            {agent.isProcessing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={agent.stopSession}
              >
                <StopIcon className="mr-1 h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{taskTitle}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Plan Review Section */}
        {agent.isAwaitingApproval && agent.plan && (
          <PlanReview
            plan={agent.plan}
            showFeedbackInput={showFeedbackInput}
            feedbackText={feedbackText}
            onFeedbackChange={setFeedbackText}
            onShowFeedback={() => setShowFeedbackInput(true)}
            onHideFeedback={() => setShowFeedbackInput(false)}
            onApprove={handleApprovePlan}
            onRequestChanges={handleRequestChanges}
          />
        )}

        {/* Tool Calls */}
        {agent.toolCalls.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tools Used</h4>
            <div className="flex flex-wrap gap-2">
              {agent.toolCalls.map((tool) => (
                <ToolCallBadge
                  key={tool.id}
                  tool={tool}
                  expanded={expandedTools.has(tool.id)}
                  onToggle={() => toggleToolExpanded(tool.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {agent.messages.length > 0 && (
          <ScrollArea className="h-[200px] rounded-md border bg-muted/30 p-3">
            <div className="space-y-2">
              {agent.messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Loading State */}
        {agent.isProcessing && agent.messages.length === 0 && !agent.plan && (
          <div className="flex items-center justify-center py-8">
            <CircleNotchIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Agent is working...</span>
          </div>
        )}

        {/* Error Message */}
        {agent.errorMessage && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <WarningIcon className="h-4 w-4" />
            {agent.errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Status badge component
function StatusBadge({ status, currentTurn }: { status: TaskAgentStatus; currentTurn: number }) {
  const statusConfig: Record<TaskAgentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    disconnected: { label: 'Disconnected', variant: 'outline', icon: null },
    connecting: { label: 'Connecting', variant: 'secondary', icon: <CircleNotchIcon className="h-3 w-3 animate-spin" /> },
    queued: { label: 'Queued', variant: 'secondary', icon: <ClockIcon className="h-3 w-3" /> },
    planning: { label: 'Planning', variant: 'secondary', icon: <CircleNotchIcon className="h-3 w-3 animate-spin" /> },
    awaiting_approval: { label: 'Awaiting Approval', variant: 'default', icon: <PencilSimpleIcon className="h-3 w-3" /> },
    executing: { label: `Executing (Turn ${currentTurn})`, variant: 'secondary', icon: <CircleNotchIcon className="h-3 w-3 animate-spin" /> },
    completed: { label: 'Completed', variant: 'default', icon: <CheckCircleIcon className="h-3 w-3" /> },
    failed: { label: 'Failed', variant: 'destructive', icon: <XCircleIcon className="h-3 w-3" /> },
    timeout: { label: 'Timeout', variant: 'destructive', icon: <ClockIcon className="h-3 w-3" /> },
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  )
}

// Plan review component
function PlanReview({
  plan,
  showFeedbackInput,
  feedbackText,
  onFeedbackChange,
  onShowFeedback,
  onHideFeedback,
  onApprove,
  onRequestChanges,
}: {
  plan: ExecutionPlan
  showFeedbackInput: boolean
  feedbackText: string
  onFeedbackChange: (text: string) => void
  onShowFeedback: () => void
  onHideFeedback: () => void
  onApprove: () => void
  onRequestChanges: () => void
}) {
  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Execution Plan</h4>
        <Badge variant="outline">Review Required</Badge>
      </div>

      <p className="text-sm">{plan.summary}</p>

      <div className="space-y-2">
        <h5 className="text-sm font-medium">Steps:</h5>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          {plan.steps.map((step) => (
            <li key={step.id}>
              <span className="font-medium">{step.title}</span>
              <span className="text-muted-foreground"> - {step.details}</span>
            </li>
          ))}
        </ol>
      </div>

      {plan.files.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Files to modify:</h5>
          <div className="flex flex-wrap gap-2">
            {plan.files.map((file) => (
              <Badge key={file.path} variant="outline" className="text-xs">
                <span className={cn(
                  'mr-1',
                  file.action === 'create' && 'text-green-600',
                  file.action === 'modify' && 'text-blue-600',
                  file.action === 'delete' && 'text-red-600'
                )}>
                  {file.action === 'create' ? '+' : file.action === 'delete' ? '-' : '~'}
                </span>
                {file.path}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {plan.risks && plan.risks.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-sm font-medium text-amber-600">Risks:</h5>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            {plan.risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {showFeedbackInput ? (
        <div className="space-y-2">
          <Textarea
            value={feedbackText}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder="Describe what changes you'd like to the plan..."
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onHideFeedback}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onRequestChanges}
              disabled={!feedbackText.trim()}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onShowFeedback}>
            <PencilSimpleIcon className="mr-1 h-4 w-4" />
            Request Changes
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckIcon className="mr-1 h-4 w-4" />
            Approve Plan
          </Button>
        </div>
      )}
    </div>
  )
}

// Tool call badge component
function ToolCallBadge({
  tool,
  expanded,
  onToggle,
}: {
  tool: ToolUse
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
        expanded ? 'bg-muted' : 'hover:bg-muted/50'
      )}
    >
      {expanded ? (
        <CaretDownIcon className="h-3 w-3" />
      ) : (
        <CaretRightIcon className="h-3 w-3" />
      )}
      <CodeIcon className="h-3 w-3 text-muted-foreground" />
      <span>{tool.name}</span>
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          tool.status === 'running' && 'animate-pulse bg-blue-500',
          tool.status === 'completed' && 'bg-green-500',
          tool.status === 'error' && 'bg-red-500'
        )}
      />
    </button>
  )
}

// Message item component
function MessageItem({ message }: { message: ProgressMessage }) {
  return (
    <div className="text-sm whitespace-pre-wrap">
      {message.content}
    </div>
  )
}
