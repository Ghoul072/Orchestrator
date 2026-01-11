import { useState, useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSessionStatus } from '~/server/functions/agent-sessions'
import type { ToolCall, Message, AgentStatus } from './use-agent'

// Progress event for tracking agent work
export interface AgentProgress {
  turnNumber: number
  maxTurns: number
  currentTool?: string
  toolsUsed: string[]
  messagesCount: number
  isComplete: boolean
  errorMessage?: string
}

// Hook options for task-based agent
export interface UseTaskAgentOptions {
  sessionId: string
  taskId: string
  projectId?: string
  workingDirectory?: string
  onComplete?: (success: boolean) => void
  onError?: (error: string) => void
  onProgress?: (progress: AgentProgress) => void
}

// Hook return type
export interface UseTaskAgentReturn {
  status: AgentStatus
  messages: Message[]
  progress: AgentProgress
  start: (prompt: string) => void
  stop: () => void
  isRunning: boolean
}

const WS_URL = 'ws://localhost:3001/ws'

export function useTaskAgent(options: UseTaskAgentOptions): UseTaskAgentReturn {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AgentStatus>('disconnected')
  const [messages, setMessages] = useState<Message[]>([])
  const [progress, setProgress] = useState<AgentProgress>({
    turnNumber: 0,
    maxTurns: 50,
    toolsUsed: [],
    messagesCount: 0,
    isComplete: false,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)

  // Update session status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      updateSessionStatus({
        data: {
          id: options.sessionId,
          status: newStatus as 'executing' | 'completed' | 'failed',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-session', options.taskId] })
    },
  })

  // Get auth session from cookie
  const getAuthSession = useCallback((): string | null => {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'session') {
        return value
      }
    }
    return null
  }, [])

  // Append content to current assistant message
  const appendAssistantContent = useCallback((content: string) => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1]

      if (
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.id === currentAssistantIdRef.current
      ) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + content },
        ]
      } else {
        const newId = crypto.randomUUID()
        currentAssistantIdRef.current = newId
        return [
          ...prev,
          {
            id: newId,
            role: 'assistant' as const,
            content,
            toolCalls: [],
            timestamp: Date.now(),
          },
        ]
      }
    })

    // Update progress message count
    setProgress((prev) => ({
      ...prev,
      messagesCount: prev.messagesCount + 1,
    }))
  }, [])

  // Track tool call
  const appendToolCall = useCallback((toolCall: ToolCall) => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1]

      if (
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.id === currentAssistantIdRef.current
      ) {
        const existingCall = lastMessage.toolCalls?.find(
          (tc) => tc.id === toolCall.id
        )

        if (existingCall) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              toolCalls: lastMessage.toolCalls?.map((tc) =>
                tc.id === toolCall.id ? { ...tc, ...toolCall } : tc
              ),
            },
          ]
        } else {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              toolCalls: [...(lastMessage.toolCalls || []), toolCall],
            },
          ]
        }
      }

      return prev
    })

    // Update progress with tool info
    setProgress((prev) => {
      const newToolsUsed = prev.toolsUsed.includes(toolCall.name)
        ? prev.toolsUsed
        : [...prev.toolsUsed, toolCall.name]

      const newProgress = {
        ...prev,
        currentTool: toolCall.name,
        toolsUsed: newToolsUsed,
        turnNumber: prev.turnNumber + 1,
      }

      options.onProgress?.(newProgress)
      return newProgress
    })
  }, [options])

  // Track tool result
  const appendToolResult = useCallback(
    (toolUseId: string, result: unknown, isError: boolean) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]

        if (
          lastMessage &&
          lastMessage.role === 'assistant' &&
          lastMessage.id === currentAssistantIdRef.current
        ) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              toolCalls: lastMessage.toolCalls?.map((tc) =>
                tc.id === toolUseId
                  ? {
                      ...tc,
                      result,
                      status: isError ? ('error' as const) : ('completed' as const),
                      isError,
                    }
                  : tc
              ),
            },
          ]
        }

        return prev
      })

      // Clear current tool in progress
      setProgress((prev) => ({
        ...prev,
        currentTool: undefined,
      }))
    },
    []
  )

  // Finalize on complete
  const finalizeToolCalls = useCallback(() => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1]

      if (
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.id === currentAssistantIdRef.current
      ) {
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            toolCalls: lastMessage.toolCalls?.map((tc) =>
              tc.status === 'running' ? { ...tc, status: 'completed' as const } : tc
            ),
          },
        ]
      }

      return prev
    })
  }, [])

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'connected':
            setStatus('processing')
            updateStatusMutation.mutate('executing')
            break

          case 'assistant_message':
            if (data.content) {
              appendAssistantContent(data.content)
            }
            break

          case 'tool_use':
            if (data.toolId) {
              const toolCall: ToolCall = {
                id: data.toolId,
                name: data.toolName || 'unknown',
                input: data.toolInput,
                status: 'running',
              }
              appendToolCall(toolCall)
            }
            break

          case 'tool_result':
            if (data.toolUseId) {
              appendToolResult(
                data.toolUseId,
                data.toolResult,
                data.toolResultIsError || false
              )
            }
            break

          case 'result':
            setStatus('ready')
            finalizeToolCalls()

            const success = data.success !== false
            setProgress((prev) => ({
              ...prev,
              isComplete: true,
              currentTool: undefined,
            }))

            // Update session status in database
            updateStatusMutation.mutate(success ? 'completed' : 'failed')
            options.onComplete?.(success)

            // Reset for next turn
            currentAssistantIdRef.current = null

            // Close connection after completion
            wsRef.current?.close()
            break

          case 'error':
            setStatus('error')
            setProgress((prev) => ({
              ...prev,
              isComplete: true,
              errorMessage: data.error,
            }))
            updateStatusMutation.mutate('failed')
            options.onError?.(data.error || 'Unknown error')
            break

          case 'pong':
            break
        }
      } catch (error) {
        console.error('[TaskAgent] Failed to parse message:', error)
      }
    },
    [
      appendAssistantContent,
      appendToolCall,
      appendToolResult,
      finalizeToolCalls,
      updateStatusMutation,
      options,
    ]
  )

  // Start the agent with a prompt
  const start = useCallback(
    (prompt: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      // Use auth session if available, otherwise use 'dev' placeholder for development
      const sessionId = getAuthSession() || 'dev'

      setStatus('connecting')
      setMessages([])
      setProgress({
        turnNumber: 0,
        maxTurns: 50,
        toolsUsed: [],
        messagesCount: 0,
        isComplete: false,
      })

      const cwd = encodeURIComponent(options.workingDirectory || '/tmp')
      const projectParam = options.projectId
        ? `&projectId=${encodeURIComponent(options.projectId)}`
        : ''
      const taskParam = `&taskId=${encodeURIComponent(options.taskId)}`

      const ws = new WebSocket(
        `${WS_URL}?session=${encodeURIComponent(sessionId)}&cwd=${cwd}${projectParam}${taskParam}`
      )

      ws.onopen = () => {
        console.log('[TaskAgent] WebSocket connected, sending initial prompt')
        // Send the initial prompt after connection
        ws.send(JSON.stringify({ type: 'chat', content: prompt }))
      }

      ws.onmessage = handleMessage

      ws.onerror = (error) => {
        console.error('[TaskAgent] WebSocket error:', error)
        setStatus('error')
        options.onError?.('Connection error')
      }

      ws.onclose = () => {
        console.log('[TaskAgent] WebSocket closed')
        setStatus('disconnected')
        wsRef.current = null
      }

      wsRef.current = ws
    },
    [getAuthSession, handleMessage, options]
  )

  // Stop the agent
  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
    updateStatusMutation.mutate('failed')
  }, [updateStatusMutation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    status,
    messages,
    progress,
    start,
    stop,
    isRunning: status === 'connecting' || status === 'processing',
  }
}
