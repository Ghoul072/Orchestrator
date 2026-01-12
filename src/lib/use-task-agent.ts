import { useState, useCallback, useRef, useEffect } from 'react'
import type { ExecutionPlan } from '~/server/db/schema'

// Session status from server
export type TaskAgentStatus =
  | 'disconnected'
  | 'connecting'
  | 'queued'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout'

// Tool use event
export interface ToolUse {
  id: string
  name: string
  status: 'running' | 'completed' | 'error'
  startedAt: number
}

// Progress message
export interface ProgressMessage {
  id: string
  content: string
  timestamp: number
}

// Hook options
export interface UseTaskAgentOptions {
  sessionId: string
  onPlanReady?: (plan: ExecutionPlan) => void
  onStatusChange?: (status: TaskAgentStatus) => void
  onError?: (error: string) => void
  onComplete?: (success: boolean) => void
  autoConnect?: boolean
}

// Hook return type
export interface UseTaskAgentReturn {
  status: TaskAgentStatus
  plan: ExecutionPlan | null
  messages: ProgressMessage[]
  toolCalls: ToolUse[]
  currentStepId: string | null
  currentTurn: number
  errorMessage: string | null
  connect: () => void
  disconnect: () => void
  approvePlan: () => void
  requestChanges: (feedback: string) => void
  stopSession: () => void
  isConnected: boolean
  isProcessing: boolean
  isAwaitingApproval: boolean
}

const WS_URL = 'ws://localhost:3001/ws/task'

export function useTaskAgent(options: UseTaskAgentOptions): UseTaskAgentReturn {
  const { sessionId, onPlanReady, onStatusChange, onError, onComplete, autoConnect = true } = options

  const [status, setStatus] = useState<TaskAgentStatus>('disconnected')
  const [plan, setPlan] = useState<ExecutionPlan | null>(null)
  const [messages, setMessages] = useState<ProgressMessage[]>([])
  const [toolCalls, setToolCalls] = useState<ToolUse[]>([])
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Update status and notify
  const updateStatus = useCallback((newStatus: TaskAgentStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'session_state':
          // Initial state sync
          if (data.status) {
            updateStatus(data.status as TaskAgentStatus)
          }
          if (data.plan) {
            setPlan(data.plan)
          }
          if (data.currentStepId) {
            setCurrentStepId(data.currentStepId)
          }
          if (typeof data.currentTurn === 'number') {
            setCurrentTurn(data.currentTurn)
          }
          if (data.errorMessage) {
            setErrorMessage(data.errorMessage)
          }
          break

        case 'progress':
          // Handle progress events from task agent
          // eventType is the actual event type (status_change, tool_use, message, etc.)
          if (data.status) {
            updateStatus(data.status as TaskAgentStatus)
          }

          // Handle message content (eventType === 'message')
          if (data.eventType === 'message' && data.content) {
            setMessages(prev => [
              ...prev,
              {
                id: crypto.randomUUID(),
                content: data.content,
                timestamp: Date.now(),
              },
            ])
          }

          // Handle tool use (eventType === 'tool_use')
          if (data.eventType === 'tool_use' && data.toolName) {
            setToolCalls(prev => {
              const existing = prev.find(t => t.id === data.toolId)
              if (existing) {
                return prev.map(t =>
                  t.id === data.toolId
                    ? { ...t, status: 'completed' as const }
                    : t
                )
              }
              return [
                ...prev,
                {
                  id: data.toolId || crypto.randomUUID(),
                  name: data.toolName,
                  status: 'running' as const,
                  startedAt: Date.now(),
                },
              ]
            })
          }

          // Handle plan ready (eventType === 'plan_ready')
          if (data.eventType === 'plan_ready' && data.plan) {
            setPlan(data.plan)
            onPlanReady?.(data.plan)
          }

          // Handle error (eventType === 'error')
          if (data.eventType === 'error' && data.error) {
            setErrorMessage(data.error)
            onError?.(data.error)
          }

          // Handle completion (eventType === 'result')
          if (data.eventType === 'result' && data.success !== undefined) {
            onComplete?.(data.success)
          }
          break

        case 'plan_approved':
          updateStatus('executing')
          break

        case 'plan_revision_started':
          updateStatus('planning')
          break

        case 'session_stopped':
          updateStatus('failed')
          setErrorMessage('Session stopped by user')
          break

        case 'error':
          setErrorMessage(data.error)
          onError?.(data.error)
          break

        case 'pong':
          // Heartbeat response
          break
      }
    } catch (error) {
      console.error('[TaskAgent] Failed to parse message:', error)
    }
  }, [updateStatus, onPlanReady, onError, onComplete])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    updateStatus('connecting')

    const ws = new WebSocket(`${WS_URL}?sessionId=${encodeURIComponent(sessionId)}`)

    ws.onopen = () => {
      console.log('[TaskAgent] WebSocket connected')

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }

    ws.onmessage = handleMessage

    ws.onerror = (error) => {
      console.error('[TaskAgent] WebSocket error:', error)
      onError?.('Connection error')
    }

    ws.onclose = () => {
      console.log('[TaskAgent] WebSocket closed')
      updateStatus('disconnected')

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      wsRef.current = null
    }

    wsRef.current = ws
  }, [sessionId, handleMessage, updateStatus, onError])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    updateStatus('disconnected')
  }, [updateStatus])

  // Approve the current plan
  const approvePlan = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('Not connected')
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'approve_plan',
      sessionId,
    }))
  }, [sessionId, onError])

  // Request changes to the plan
  const requestChanges = useCallback((feedback: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('Not connected')
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'request_plan_changes',
      sessionId,
      feedback,
    }))

    // Clear current plan
    setPlan(null)
  }, [sessionId, onError])

  // Stop the current session
  const stopSession = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('Not connected')
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'stop_session',
      sessionId,
    }))
  }, [sessionId, onError])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && sessionId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    plan,
    messages,
    toolCalls,
    currentStepId,
    currentTurn,
    errorMessage,
    connect,
    disconnect,
    approvePlan,
    requestChanges,
    stopSession,
    isConnected: status !== 'disconnected' && status !== 'connecting',
    isProcessing: status === 'planning' || status === 'executing',
    isAwaitingApproval: status === 'awaiting_approval',
  }
}
