import { agentManager } from './acp/agent-manager'
import { db } from './db'
import { projects, taskUpdates } from './db/schema'
import { eq } from 'drizzle-orm'

const WS_PORT = Number(process.env.WS_PORT) || 3001

// WebSocket connection data
interface WebSocketData {
  agentSessionId: string | null
  workingDirectory: string
  projectId: string | null
  taskId: string | null
  isListening: boolean
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

type ClientMessage = ChatMessage | PingMessage

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
      return new Response(
        JSON.stringify({
          status: 'ok',
          activeSessions: agentManager.getActiveSessions().length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // WebSocket upgrade at /ws endpoint
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
      console.log(`[WS] New connection, setting up agent session...`)

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
          const agentSessionId = agentManager.createSession(workingDirectory, {
            systemPrompt,
            projectId: data.projectId ?? undefined,
            taskId: data.taskId ?? undefined,
          })
          data.agentSessionId = agentSessionId

          console.log(
            `[WS] Agent session ${agentSessionId} created`
          )

          // Send connected message
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'connected', sessionId: agentSessionId }))
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
      const { agentSessionId } = data

      console.log(`[WS] Connection closed${agentSessionId ? `, session ${agentSessionId}` : ''}`)

      if (agentSessionId) {
        agentManager.destroySession(agentSessionId)
      }
    },
  },
})

console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`)
console.log(`[WS] Health check: http://localhost:${WS_PORT}/health`)

export { server }
