import { agentManager } from './acp/agent-manager'
import {
  startQueueProcessor,
  subscribeToProgress,
  continueAfterApproval,
  startSession,
  stopSession,
} from './acp/task-agent-processor'
import * as agentSessionsDb from './db/agent-sessions'
import { db } from './db'
import { projects, tasks, taskUpdates } from './db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const WS_PORT = Number(process.env.WS_PORT) || 3001

// Track WebSocket connections by session ID for progress broadcasts
const sessionConnections = new Map<string, Set<{ ws: unknown; send: (data: string) => void }>>()

// WebSocket connection data
interface WebSocketData {
  agentSessionId: string | null
  workingDirectory: string
  projectId: string | null
  taskId: string | null
  isListening: boolean
  // Task agent specific
  taskAgentSessionId: string | null
  isTaskAgent: boolean
}

// Client message types
interface ChatMessage {
  type: 'chat'
  content: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface PingMessage {
  type: 'ping'
}

// Task agent messages
interface SubscribeTaskAgentMessage {
  type: 'subscribe_task_agent'
  sessionId: string
}

interface ApprovePlanMessage {
  type: 'approve_plan'
  sessionId: string
}

interface RequestPlanChangesMessage {
  type: 'request_plan_changes'
  sessionId: string
  feedback: string
}

interface StopSessionMessage {
  type: 'stop_session'
  sessionId: string
}

type ClientMessage =
  | ChatMessage
  | PingMessage
  | SubscribeTaskAgentMessage
  | ApprovePlanMessage
  | RequestPlanChangesMessage
  | StopSessionMessage

// Get project context for agent system prompt
async function getProjectContext(projectId: string | null): Promise<string | null> {
  if (!projectId) return null

  try {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (project.length === 0) return null

    const p = project[0]
    let context = `# Project: ${p.name}\n\n`

    if (p.description) {
      context += `## Description\n${p.description}\n\n`
    }

    if (p.agentContext) {
      context += `## Agent Instructions\n${p.agentContext}\n\n`
    }

    // Fetch project tasks for context
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.parentId)))
      .limit(50)

    if (projectTasks.length > 0) {
      context += `## Current Tasks\n\n`
      for (const task of projectTasks) {
        const statusEmoji =
          task.status === 'completed' ? '✅' :
          task.status === 'in_progress' ? '🔄' :
          task.status === 'blocked' ? '🚫' :
          task.status === 'cancelled' ? '❌' : '⏳'

        context += `- ${statusEmoji} **${task.title}** (${task.status})\n`
        if (task.description) {
          context += `  ${task.description.slice(0, 200)}${task.description.length > 200 ? '...' : ''}\n`
        }
        if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
          context += `  Acceptance criteria: ${task.acceptanceCriteria.join(', ')}\n`
        }
      }
      context += '\n'
    }

    return context
  } catch (error) {
    console.error('[WS] Error fetching project context:', error)
    return null
  }
}

// Build system prompt with project context
function buildSystemPrompt(
  workingDirectory: string,
  projectContext: string | null
): string {
  const basePrompt = `You are an AI assistant helping with software development tasks in Orchestrator, a project management tool for Claude Code.

You have access to tools for reading, writing, and searching files, as well as executing shell commands.

## Your Capabilities

1. **Discuss and clarify requirements** - Help users understand and refine their project requirements
2. **Plan implementation** - Break down tasks into actionable steps with clear acceptance criteria
3. **Analyze codebase** - Read and understand existing code to inform decisions
4. **Suggest task updates** - Recommend changes to task descriptions, priorities, or acceptance criteria
5. **Execute development tasks** - Write code, run tests, and make changes when asked

## Guidelines

- When discussing tasks, reference them by title and provide specific, actionable suggestions
- If requirements are unclear, ask clarifying questions before suggesting implementation
- When proposing task changes, be explicit: "I suggest updating task 'X' to include..."
- For implementation discussions, consider existing patterns in the codebase
- Be proactive in identifying potential issues or missing requirements

Be helpful, concise, and focus on completing the user's tasks effectively.`

  const contextBlock = projectContext
    ? `\n\n${projectContext}`
    : ''

  return `${basePrompt}${contextBlock}

Working directory: ${workingDirectory}`
}

// Resolve and validate working directory
function resolvePath(path: string): string {
  // Basic sanitization - prevent directory traversal
  const normalized = path.replace(/\.\./g, '').replace(/\/+/g, '/')
  return normalized.startsWith('/') ? normalized : `/tmp/${normalized}`
}

console.log(`[WS] Starting WebSocket server on port ${WS_PORT}...`)

const server = Bun.serve<WebSocketData>({
  port: WS_PORT,

  fetch(request, server) {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/health') {
      const stats = agentManager.getStats()
      return new Response(
        JSON.stringify({
          status: 'ok',
          ...stats,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Agent stats endpoint
    if (url.pathname === '/stats') {
      const stats = agentManager.getStats()
      const queued = agentManager.getQueuedSessions()
      return new Response(
        JSON.stringify({
          ...stats,
          queuedSessionDetails: queued,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // WebSocket upgrade at /ws endpoint (chat panel)
    if (url.pathname === '/ws') {
      const workingDirectory = url.searchParams.get('cwd') || '/tmp'
      const projectId = url.searchParams.get('projectId')
      const taskId = url.searchParams.get('taskId')

      const upgraded = server.upgrade(request, {
        data: {
          agentSessionId: null,
          workingDirectory,
          projectId,
          taskId,
          isListening: false,
          taskAgentSessionId: null,
          isTaskAgent: false,
        },
      })

      return upgraded
        ? undefined
        : new Response('WebSocket upgrade failed', { status: 500 })
    }

    // WebSocket upgrade at /ws/task endpoint (task agent progress)
    if (url.pathname === '/ws/task') {
      const sessionId = url.searchParams.get('sessionId')

      const upgraded = server.upgrade(request, {
        data: {
          agentSessionId: null,
          workingDirectory: '/tmp',
          projectId: null,
          taskId: null,
          isListening: false,
          taskAgentSessionId: sessionId,
          isTaskAgent: true,
        },
      })

      return upgraded
        ? undefined
        : new Response('WebSocket upgrade failed', { status: 500 })
    }

    return new Response('Not Found', { status: 404 })
  },

  websocket: {
    open(ws) {
      const data = ws.data

      // Handle task agent connections
      if (data.isTaskAgent) {
        console.log(`[WS] New task agent connection for session ${data.taskAgentSessionId}`)

        if (data.taskAgentSessionId) {
          // Add to session connections
          if (!sessionConnections.has(data.taskAgentSessionId)) {
            sessionConnections.set(data.taskAgentSessionId, new Set())
          }
          sessionConnections.get(data.taskAgentSessionId)!.add({
            ws,
            send: (msg: string) => {
              if (ws.readyState === 1) ws.send(msg)
            },
          })

          // Subscribe to progress events
          const unsubscribe = subscribeToProgress(
            data.taskAgentSessionId,
            (_sessionId, event) => {
              if (ws.readyState === 1) {
                // Send progress event with eventType to distinguish from outer message type
                ws.send(JSON.stringify({
                  type: 'progress',
                  eventType: event.type,
                  status: event.status,
                  content: event.content,
                  toolName: event.toolName,
                  toolId: event.toolId,
                  plan: event.plan,
                  success: event.success,
                  error: event.error,
                  cost: event.cost,
                  duration: event.duration,
                }))
              }
            }
          )

          // Store unsubscribe function for cleanup
          ;(data as { _unsubscribe?: () => void })._unsubscribe = unsubscribe

          // Fetch and send current session state
          void (async () => {
            try {
              const session = await agentSessionsDb.getSessionById(data.taskAgentSessionId!)
              if (session) {
                ws.send(JSON.stringify({
                  type: 'session_state',
                  status: session.status,
                  plan: session.plan,
                  currentStepId: session.currentStepId,
                  currentTurn: session.currentTurn,
                  errorMessage: session.errorMessage,
                }))
              }
            } catch (error) {
              console.error('[WS] Error fetching session state:', error)
            }
          })()
        }
        return
      }

      // Handle chat panel connections
      console.log(`[WS] New chat connection, setting up agent session...`)

      // Create agent session asynchronously
      void (async () => {
        try {
          const workingDirectory = resolvePath(data.workingDirectory)

          // Get project context
          const projectContext = await getProjectContext(data.projectId)

          // Build system prompt
          const systemPrompt = buildSystemPrompt(
            workingDirectory,
            projectContext
          )

          // Create agent session
          const result = agentManager.createSession(workingDirectory, {
            systemPrompt,
            projectId: data.projectId ?? undefined,
            taskId: data.taskId ?? undefined,
          })

          // Handle queued or immediate start
          if (typeof result === 'string') {
            data.agentSessionId = result
            console.log(`[WS] Agent session ${result} created`)
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'connected', sessionId: result }))
            }
          } else {
            // Session was queued
            data.agentSessionId = result.sessionId
            console.log(`[WS] Agent session ${result.sessionId} queued at position ${result.queuePosition}`)
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'queued',
                sessionId: result.sessionId,
                queuePosition: result.queuePosition,
              }))
            }
          }
        } catch (error) {
          console.error('[WS] Error during session setup:', error)
          ws.send(
            JSON.stringify({
              type: 'error',
              error:
                error instanceof Error ? error.message : 'Session setup failed',
            })
          )
          ws.close(1011, 'Session setup failed')
        }
      })()
    },

    async message(ws, message) {
      const data = ws.data
      const { agentSessionId } = data

      try {
        const msg: ClientMessage = JSON.parse(
          typeof message === 'string'
            ? message
            : new TextDecoder().decode(message)
        )

        // Handle ping
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        // Handle task agent subscription
        if (msg.type === 'subscribe_task_agent') {
          const { sessionId } = msg
          data.taskAgentSessionId = sessionId
          data.isTaskAgent = true

          // Add to session connections
          if (!sessionConnections.has(sessionId)) {
            sessionConnections.set(sessionId, new Set())
          }
          sessionConnections.get(sessionId)!.add({
            ws,
            send: (str: string) => {
              if (ws.readyState === 1) ws.send(str)
            },
          })

          // Subscribe to progress events
          const unsubscribe = subscribeToProgress(sessionId, (_sid, event) => {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'progress',
                eventType: event.type,
                status: event.status,
                content: event.content,
                toolName: event.toolName,
                toolId: event.toolId,
                plan: event.plan,
                success: event.success,
                error: event.error,
                cost: event.cost,
                duration: event.duration,
              }))
            }
          })
          ;(data as { _unsubscribe?: () => void })._unsubscribe = unsubscribe

          // Send current session state
          const session = await agentSessionsDb.getSessionById(sessionId)
          if (session) {
            ws.send(JSON.stringify({
              type: 'session_state',
              status: session.status,
              plan: session.plan,
              currentStepId: session.currentStepId,
              currentTurn: session.currentTurn,
              errorMessage: session.errorMessage,
            }))
          }
          return
        }

        // Handle plan approval
        if (msg.type === 'approve_plan') {
          const { sessionId } = msg
          console.log(`[WS] Plan approved for session ${sessionId}`)

          // Update session status to executing
          await agentSessionsDb.updateSessionStatus(sessionId, 'executing')

          // Continue execution
          await continueAfterApproval(sessionId)

          ws.send(JSON.stringify({
            type: 'plan_approved',
            sessionId,
            status: 'executing',
          }))
          return
        }

        // Handle request for plan changes
        if (msg.type === 'request_plan_changes') {
          const { sessionId, feedback } = msg
          console.log(`[WS] Plan changes requested for session ${sessionId}`)

          // Update session with feedback
          await agentSessionsDb.requestPlanChanges(sessionId, feedback)

          // Restart the planning session
          await startSession(sessionId)

          ws.send(JSON.stringify({
            type: 'plan_revision_started',
            sessionId,
            status: 'planning',
          }))
          return
        }

        // Handle session stop
        if (msg.type === 'stop_session') {
          const { sessionId } = msg
          console.log(`[WS] Stopping session ${sessionId}`)

          const stopped = stopSession(sessionId)
          if (stopped) {
            await agentSessionsDb.updateSessionStatus(sessionId, 'failed', 'Stopped by user')
          }

          ws.send(JSON.stringify({
            type: 'session_stopped',
            sessionId,
            success: stopped,
          }))
          return
        }

        // Handle chat messages
        if (msg.type === 'chat') {
          if (!agentSessionId) {
            ws.send(
              JSON.stringify({
                type: 'error',
                error: 'No active session. Please wait for connection.',
              })
            )
            return
          }

          // Build message with conversation history context
          let messageContent = msg.content
          if (msg.history && msg.history.length > 0) {
            // Limit history to last 20 messages for context window
            const recentHistory = msg.history.slice(-20)
            const historyContext = recentHistory
              .map(
                (m) =>
                  `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
              )
              .join('\n\n')
            messageContent = `<conversation_history>\n${historyContext}\n</conversation_history>\n\nUser: ${msg.content}`
          }

          // Send message to agent
          agentManager.sendMessage(agentSessionId, messageContent)

          // Start streaming if not already listening
          if (!data.isListening) {
            data.isListening = true

            // Fire and forget - stream responses to client
            ;(async () => {
              // Get task ID from agent session for saving updates
              const agentSession = agentManager.getSession(agentSessionId)
              const taskId = agentSession?.taskId || data.taskId

              // Accumulate assistant content for task update
              let accumulatedContent = ''

              try {
                for await (const response of agentManager.getOutputStream(
                  agentSessionId
                )) {
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify(response))
                  } else {
                    break
                  }

                  // Accumulate assistant messages
                  if (response.type === 'assistant_message' && response.content) {
                    accumulatedContent += response.content
                  }

                  // Save task update when agent completes
                  if (response.type === 'result' && taskId && accumulatedContent.trim()) {
                    try {
                      await db.insert(taskUpdates).values({
                        taskId,
                        content: accumulatedContent.trim(),
                        updateType: response.success ? 'progress' : 'blocker',
                        author: 'Agent',
                        metadata: {
                          cost: response.cost,
                          duration: response.duration,
                          success: response.success,
                        } as Record<string, unknown> as Record<string, object>,
                      })
                      console.log(`[WS] Saved agent response as task update for task ${taskId}`)
                    } catch (updateError) {
                      console.error('[WS] Failed to save task update:', updateError)
                    }
                    accumulatedContent = ''
                  }
                }
              } catch (error) {
                console.error(
                  `[WS] Stream error for session ${agentSessionId}:`,
                  error
                )
                if (ws.readyState === 1) {
                  ws.send(
                    JSON.stringify({
                      type: 'error',
                      error:
                        error instanceof Error ? error.message : 'Stream error',
                    })
                  )
                }
              } finally {
                data.isListening = false
              }
            })()
          }
        }
      } catch (error) {
        console.error('[WS] Message handling error:', error)
        ws.send(
          JSON.stringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Failed to process message',
          })
        )
      }
    },

    close(ws) {
      const data = ws.data
      const { agentSessionId, taskAgentSessionId, isTaskAgent } = data

      // Clean up task agent connections
      if (isTaskAgent && taskAgentSessionId) {
        console.log(`[WS] Task agent connection closed for session ${taskAgentSessionId}`)

        // Unsubscribe from progress events
        const unsubscribe = (data as { _unsubscribe?: () => void })._unsubscribe
        if (unsubscribe) unsubscribe()

        // Remove from session connections
        const connections = sessionConnections.get(taskAgentSessionId)
        if (connections) {
          for (const conn of connections) {
            if (conn.ws === ws) {
              connections.delete(conn)
              break
            }
          }
          if (connections.size === 0) {
            sessionConnections.delete(taskAgentSessionId)
          }
        }
        return
      }

      // Clean up chat panel connections
      console.log(`[WS] Chat connection closed${agentSessionId ? `, session ${agentSessionId}` : ''}`)

      if (agentSessionId) {
        agentManager.destroySession(agentSessionId)
      }
    },
  },
})

console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`)
console.log(`[WS] Health check: http://localhost:${WS_PORT}/health`)

// Start the task agent queue processor
startQueueProcessor(5000)
console.log(`[WS] Task agent queue processor started`)

export { server }
