import { useState, useCallback, useRef, useEffect } from 'react'

// Agent connection status
export type AgentStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'processing'
  | 'error'

// Tool call tracking
export interface ToolCall {
  id: string
  name: string
  input?: unknown
  result?: unknown
  status: 'running' | 'completed' | 'error'
  isError?: boolean
}

// Chat message
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
  cost?: number
  duration?: number
}

// Agent info
export interface AgentInfo {
  sessionId: string | null
}

// Hook options
export interface UseAgentOptions {
  workingDirectory?: string
  projectId?: string
  onError?: (error: string) => void
  onConnected?: (sessionId: string) => void
  autoConnect?: boolean
}

// Hook return type
export interface UseAgentReturn {
  status: AgentStatus
  messages: Message[]
  agentInfo: AgentInfo
  connect: () => void
  disconnect: () => void
  sendPrompt: (content: string, options?: { displayContent?: string }) => void
  clearMessages: () => void
  isConnected: boolean
  isProcessing: boolean
}

const WS_URL = 'ws://localhost:3001/ws'

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const [status, setStatus] = useState<AgentStatus>('disconnected')
  const [messages, setMessages] = useState<Message[]>([])
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({ sessionId: null })

  const wsRef = useRef<WebSocket | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

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
        // Append to existing message
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + content },
        ]
      } else {
        // Create new assistant message
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
  }, [])

  // Append tool call to current assistant message
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
          // Update existing tool call
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
          // Add new tool call
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
  }, [])

  // Append tool result
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
    },
    []
  )

  // Finalize tool calls (mark remaining as completed)
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
            setAgentInfo({ sessionId: data.sessionId })
            setStatus('ready')
            options.onConnected?.(data.sessionId)
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

            // Update last message with cost/duration
            if (data.cost || data.duration) {
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      cost: data.cost,
                      duration: data.duration,
                    },
                  ]
                }
                return prev
              })
            }

            // Reset for next turn
            currentAssistantIdRef.current = null
            break

          case 'error':
            setStatus('error')
            options.onError?.(data.error || 'Unknown error')
            break

          case 'pong':
            // Heartbeat response
            break
        }
      } catch (error) {
        console.error('[Agent] Failed to parse message:', error)
      }
    },
    [
      appendAssistantContent,
      appendToolCall,
      appendToolResult,
      finalizeToolCalls,
      options,
    ]
  )

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Use auth session if available, otherwise use 'dev' placeholder for development
    const sessionId = getAuthSession() || 'dev'

    setStatus('connecting')

    const cwd = encodeURIComponent(options.workingDirectory || '/tmp')
    const projectParam = options.projectId
      ? `&projectId=${encodeURIComponent(options.projectId)}`
      : ''

    const ws = new WebSocket(
      `${WS_URL}?session=${encodeURIComponent(sessionId)}&cwd=${cwd}${projectParam}`
    )

    ws.onopen = () => {
      console.log('[Agent] WebSocket connected')
    }

    ws.onmessage = handleMessage

    ws.onerror = (error) => {
      console.error('[Agent] WebSocket error:', error)
      setStatus('error')
      options.onError?.('Connection error')
    }

    ws.onclose = () => {
      console.log('[Agent] WebSocket closed')
      setStatus('disconnected')
      setAgentInfo({ sessionId: null })
      wsRef.current = null
    }

    wsRef.current = ws
  }, [getAuthSession, handleMessage, options])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('disconnected')
    setAgentInfo({ sessionId: null })
  }, [])

  // Send a prompt to the agent
  const sendPrompt = useCallback(
    (content: string, sendOptions?: { displayContent?: string }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        options.onError?.('Not connected to agent')
        return
      }

      // Build conversation history (limit to last 20)
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      // Add user message to local state
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: sendOptions?.displayContent ?? content,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Send to WebSocket
      wsRef.current.send(JSON.stringify({ type: 'chat', content, history }))
      setStatus('processing')
    },
    [messages, options]
  )

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    currentAssistantIdRef.current = null
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    messages,
    agentInfo,
    connect,
    disconnect,
    sendPrompt,
    clearMessages,
    isConnected: status === 'ready' || status === 'processing',
    isProcessing: status === 'processing',
  }
}
