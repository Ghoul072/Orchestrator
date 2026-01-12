import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAgent, type Message, type ToolCall } from '~/lib/use-agent'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Textarea } from '~/components/ui/textarea'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Badge } from '~/components/ui/badge'
import {
  Steps,
  StepsTrigger,
  StepsContent,
  StepsItem,
} from '~/components/prompt-kit/steps'
import { Loader } from '~/components/prompt-kit/loader'
import {
  PaperPlaneRight,
  CircleNotch,
  Lightning,
  X,
  CheckCircle,
  XCircle,
  Robot,
  File,
  Pencil,
  MagnifyingGlass,
  Globe,
  Terminal,
  FolderOpen,
  Sparkle,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface ChatPanelProps {
  projectId?: string
  workingDirectory?: string
  className?: string
}

export function ChatPanel({
  projectId,
  workingDirectory,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    status,
    messages,
    connect,
    disconnect,
    sendPrompt,
    clearMessages,
    isConnected,
    isProcessing,
  } = useAgent({
    projectId,
    workingDirectory,
    onError: (error) => {
      console.error('[ChatPanel] Error:', error)
    },
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle send message
  const handleSend = () => {
    if (!input.trim() || !isConnected || isProcessing) return

    sendPrompt(input.trim())
    setInput('')

    // Focus textarea after sending
    textareaRef.current?.focus()
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Robot weight="duotone" className="h-5 w-5 text-primary" />
          Claude Code
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={cn(
              'text-xs',
              status === 'processing' && 'animate-pulse'
            )}
          >
            {status === 'disconnected' && 'Disconnected'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'ready' && 'Ready'}
            {status === 'processing' && 'Working...'}
            {status === 'error' && 'Error'}
          </Badge>
          {isConnected ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={disconnect}
              className="h-7 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={connect}
              className="h-7"
            >
              <Lightning weight="fill" className="mr-1 h-3 w-3" />
              Connect
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isConnected
                  ? 'Send a message to start the conversation.'
                  : 'Connect to start chatting with the agent.'}
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            {isProcessing && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader variant="typing" size="sm" />
                Agent is thinking...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConnected
                  ? 'Type a message... (Enter to send, Shift+Enter for newline)'
                  : 'Connect to send messages'
              }
              disabled={!isConnected || isProcessing}
              className="min-h-[60px] max-h-[200px] resize-none"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSend}
                disabled={!isConnected || isProcessing || !input.trim()}
                size="icon"
                className="h-[60px]"
              >
                {isProcessing ? (
                  <CircleNotch className="h-5 w-5 animate-spin" />
                ) : (
                  <PaperPlaneRight weight="fill" className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="mt-2 h-7 text-xs text-muted-foreground"
            >
              Clear conversation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Tool icons mapping
const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Read: File,
  Write: Pencil,
  Edit: Pencil,
  Bash: Terminal,
  Glob: FolderOpen,
  Grep: MagnifyingGlass,
  WebSearch: Globe,
  WebFetch: Globe,
  Task: Sparkle,
  TaskOutput: Sparkle,
}

// Get human-readable verb for tool action
function getToolVerb(toolName: string, isCompleted: boolean): string {
  const verbs: Record<string, [string, string]> = {
    Read: ['Reading', 'Read'],
    Write: ['Writing', 'Wrote'],
    Edit: ['Editing', 'Edited'],
    Bash: ['Running', 'Ran'],
    Grep: ['Searching', 'Searched'],
    Glob: ['Finding files', 'Found files'],
    WebSearch: ['Searching web', 'Searched web'],
    WebFetch: ['Fetching', 'Fetched'],
    Task: ['Delegating', 'Delegated'],
    TaskOutput: ['Getting output', 'Got output'],
  }
  const [present, past] = verbs[toolName] ?? [toolName, toolName]
  return isCompleted ? past : present
}

// Extract useful info from tool input for display
function getToolLabel(toolName: string, input?: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const inp = input as Record<string, unknown>

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const pathValue = inp.file_path ?? inp.filePath ?? inp.path ?? inp.filename ?? inp.file
      if (pathValue) {
        const parts = String(pathValue).split('/')
        return parts.slice(-2).join('/')
      }
      return ''
    }
    case 'Bash': {
      const cmd = inp.command ?? inp.cmd
      if (cmd) {
        const cmdStr = String(cmd)
        return cmdStr.length > 40 ? cmdStr.slice(0, 37) + '...' : cmdStr
      }
      return ''
    }
    case 'Grep':
      return inp.pattern ? String(inp.pattern) : ''
    case 'Glob':
      return inp.pattern ? String(inp.pattern) : ''
    case 'WebSearch':
      return inp.query ? String(inp.query) : ''
    case 'WebFetch': {
      try {
        return inp.url ? new URL(String(inp.url)).hostname : ''
      } catch {
        return String(inp.url).slice(0, 30)
      }
    }
    case 'Task': {
      const desc = inp.description ?? inp.subagent_type
      return desc ? String(desc) : ''
    }
    case 'TaskOutput':
      return inp.task_id ? `task ${String(inp.task_id).slice(0, 8)}` : ''
    default:
      return ''
  }
}

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0
  const toolCallsCompleted = message.toolCalls?.every(
    (t) => t.status === 'completed' || t.result !== undefined
  )

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
          <div className="mb-1 text-xs font-medium text-primary-foreground/70">
            You
          </div>
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tool calls as collapsible steps */}
      {hasToolCalls && (
        <Steps defaultOpen={!toolCallsCompleted}>
          <StepsTrigger
            leftIcon={
              toolCallsCompleted ? (
                <CheckCircle weight="fill" className="size-4 text-green-500" />
              ) : (
                <Loader variant="typing" size="sm" />
              )
            }
          >
            {toolCallsCompleted
              ? `${message.toolCalls!.length} action${message.toolCalls!.length === 1 ? '' : 's'} completed`
              : `Running ${message.toolCalls!.length} action${message.toolCalls!.length === 1 ? '' : 's'}...`}
          </StepsTrigger>
          <StepsContent>
            {message.toolCalls!.map((tool) => (
              <ToolCallItem key={tool.id} tool={tool} />
            ))}
          </StepsContent>
        </Steps>
      )}

      {/* Response text with Markdown */}
      {message.content && (
        <div
          className={cn(
            'max-w-[95%] rounded-lg px-4 py-3',
            isSystem ? 'bg-muted text-muted-foreground' : 'bg-muted'
          )}
        >
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {isSystem ? 'System' : 'Claude Code'}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:mb-4 [&>ol]:mb-4 [&>pre]:mb-4 [&>blockquote]:mb-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Metadata */}
          {(message.cost || message.duration) && (
            <div className="mt-3 flex gap-3 text-xs text-muted-foreground border-t pt-2">
              {message.cost && <span>${message.cost.toFixed(4)}</span>}
              {message.duration && <span>{(message.duration / 1000).toFixed(1)}s</span>}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <span className="px-1 text-xs text-muted-foreground">
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}

// Tool call display item
function ToolCallItem({ tool }: { tool: ToolCall }) {
  const Icon = toolIcons[tool.name] || Terminal
  const isCompleted = tool.status === 'completed' || tool.result !== undefined
  const verb = getToolVerb(tool.name, isCompleted)
  const label = getToolLabel(tool.name, tool.input)

  return (
    <StepsItem className="flex items-center gap-2 py-1">
      {isCompleted ? (
        <CheckCircle weight="fill" className="size-3.5 text-green-500 shrink-0" />
      ) : tool.status === 'error' || tool.isError ? (
        <XCircle weight="fill" className="size-3.5 text-red-500 shrink-0" />
      ) : (
        <Icon className="size-3.5 text-muted-foreground shrink-0 animate-pulse" />
      )}
      <span className="text-muted-foreground">{verb}</span>
      {label && (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono truncate max-w-[200px]">
          {label}
        </code>
      )}
      {tool.isError && Boolean(tool.result) && (
        <span className="text-xs text-red-500 truncate max-w-[150px]">
          (error)
        </span>
      )}
    </StepsItem>
  )
}
