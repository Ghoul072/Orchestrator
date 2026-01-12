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
  PaperPlaneRight,
  CircleNotch,
  Lightning,
  X,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  Terminal,
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
          <Terminal weight="duotone" className="h-5 w-5" />
          Agent Chat
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
            {status === 'processing' && 'Processing...'}
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
          <div className="space-y-4">
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
                <CircleNotch className="h-4 w-4 animate-spin" />
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

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-muted'
        )}
      >
        {/* Role label */}
        <div
          className={cn(
            'mb-1 text-xs font-medium',
            isUser
              ? 'text-primary-foreground/70'
              : 'text-muted-foreground'
          )}
        >
          {isUser ? 'You' : isSystem ? 'System' : 'Agent'}
        </div>

        {/* Content */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Metadata */}
        {(message.cost || message.duration) && (
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
            {message.cost && <span>${message.cost.toFixed(4)}</span>}
            {message.duration && <span>{(message.duration / 1000).toFixed(1)}s</span>}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="px-1 text-xs text-muted-foreground">
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}

// Tool call display component
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border bg-background/50 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
      >
        {toolCall.status === 'running' ? (
          <CircleNotch className="h-4 w-4 animate-spin text-blue-500" />
        ) : toolCall.status === 'completed' ? (
          <CheckCircle weight="fill" className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle weight="fill" className="h-4 w-4 text-red-500" />
        )}

        <span className="flex-1 font-mono text-xs">{toolCall.name}</span>

        {expanded ? (
          <CaretDown className="h-4 w-4" />
        ) : (
          <CaretRight className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 py-2">
          {toolCall.input !== undefined && (
            <div className="mb-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Input
              </div>
              <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(toolCall.input, null, 2)}
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
                  'overflow-auto rounded p-2 text-xs',
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
      )}
    </div>
  )
}
