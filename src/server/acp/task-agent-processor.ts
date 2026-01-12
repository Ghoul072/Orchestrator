import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import * as agentSessionsDb from '~/server/db/agent-sessions'
import * as tasksDb from '~/server/db/tasks'
import * as projectsDb from '~/server/db/projects'
import * as repositoriesDb from '~/server/db/repositories'
import type { AgentSession, ExecutionPlan } from '~/server/db/schema'

// Event emitter for progress updates
type ProgressCallback = (sessionId: string, event: ProgressEvent) => void

export interface ProgressEvent {
  type: 'status_change' | 'tool_use' | 'message' | 'plan_ready' | 'result' | 'error'
  status?: AgentSession['status']
  content?: string
  toolName?: string
  toolId?: string
  toolInput?: unknown
  toolResult?: unknown
  plan?: ExecutionPlan
  success?: boolean
  error?: string
  cost?: number
  duration?: number
}

// Active processing sessions
const activeSessions = new Map<string, {
  abortController: AbortController
  queue: MessageQueue
}>()

// Progress listeners per session
const progressListeners = new Map<string, Set<ProgressCallback>>()

// Message queue for multi-turn agent conversations
class MessageQueue {
  private messages: Array<{ role: 'user'; content: string }> = []
  private waiting: ((msg: { role: 'user'; content: string }) => void) | null = null
  private closed = false

  push(content: string) {
    const msg = { role: 'user' as const, content }
    if (this.waiting) {
      this.waiting(msg)
      this.waiting = null
    } else {
      this.messages.push(msg)
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift() as unknown as SDKUserMessage
      } else {
        const msg = await new Promise<{ role: 'user'; content: string }>((resolve) => {
          this.waiting = resolve
        })
        if (this.closed) break
        yield msg as unknown as SDKUserMessage
      }
    }
  }

  close() {
    this.closed = true
    if (this.waiting) {
      this.waiting({ role: 'user', content: '' })
      this.waiting = null
    }
  }
}

/**
 * Subscribe to progress events for a session
 */
export function subscribeToProgress(sessionId: string, callback: ProgressCallback): () => void {
  if (!progressListeners.has(sessionId)) {
    progressListeners.set(sessionId, new Set())
  }
  progressListeners.get(sessionId)!.add(callback)

  // Return unsubscribe function
  return () => {
    const listeners = progressListeners.get(sessionId)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) {
        progressListeners.delete(sessionId)
      }
    }
  }
}

/**
 * Emit progress event to all listeners
 */
function emitProgress(sessionId: string, event: ProgressEvent) {
  const listeners = progressListeners.get(sessionId)
  if (listeners) {
    for (const callback of listeners) {
      try {
        callback(sessionId, event)
      } catch (error) {
        console.error('[TaskAgent] Error in progress callback:', error)
      }
    }
  }
}

/**
 * Build system prompt for task agent
 */
async function buildTaskSystemPrompt(session: AgentSession): Promise<{
  systemPrompt: string
  workingDirectory: string
}> {
  if (!session.taskId) throw new Error('Session has no task ID')

  const task = await tasksDb.getTaskById(session.taskId)
  if (!task) throw new Error('Task not found')

  const project = await projectsDb.getProjectById(task.projectId)
  if (!project) throw new Error('Project not found')

  // Get repository for working directory
  let workingDirectory = '/tmp'
  if (task.repositoryId) {
    const repo = await repositoriesDb.getRepositoryById(task.repositoryId)
    if (repo?.localPath) {
      workingDirectory = repo.localPath
    }
  }

  // Get subtasks
  const subtasks = await tasksDb.getSubtasks(session.taskId!)

  // Build comprehensive system prompt
  const parts: string[] = []

  parts.push(`# Project: ${project.name}`)
  if (project.description) {
    parts.push(`\n${project.description}`)
  }
  if (project.agentContext) {
    parts.push(`\n## Project Instructions\n${project.agentContext}`)
  }

  parts.push(`\n\n# Current Task: ${task.title}`)
  parts.push(`\nStatus: ${task.status}`)
  parts.push(`Priority: ${task.priority}`)
  if (task.effort) parts.push(`Effort: ${task.effort}`)

  if (task.description) {
    parts.push(`\n## Description\n${task.description}`)
  }

  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    parts.push(`\n## Acceptance Criteria`)
    task.acceptanceCriteria.forEach((criterion, i) => {
      parts.push(`${i + 1}. ${criterion}`)
    })
  }

  if (subtasks.length > 0) {
    parts.push(`\n## Subtasks`)
    subtasks.forEach((subtask) => {
      const statusIcon =
        subtask.status === 'completed' ? '[x]' :
        subtask.status === 'in_progress' ? '[~]' : '[ ]'
      parts.push(`- ${statusIcon} ${subtask.title}`)
    })
  }

  // Check if there's feedback to incorporate
  if (session.planRequestedChanges) {
    parts.push(`\n## User Feedback on Previous Plan`)
    parts.push(session.planRequestedChanges)
    parts.push(`\nPlease revise your plan based on this feedback.`)
  }

  parts.push(`\n\n# Instructions`)
  parts.push(`You are working on this task. Your goal is to complete all acceptance criteria.`)
  parts.push(`- First, analyze the codebase and create a detailed execution plan`)
  parts.push(`- The plan should list specific files to create/modify and the approach`)
  parts.push(`- After planning, execute each step carefully`)
  parts.push(`- Write tests for new functionality`)
  parts.push(`- Make focused, incremental changes`)

  parts.push(`\nWorking directory: ${workingDirectory}`)

  return {
    systemPrompt: parts.join('\n'),
    workingDirectory,
  }
}

/**
 * Start processing a queued session
 */
export async function startSession(sessionId: string): Promise<void> {
  // Get session from DB
  const session = await agentSessionsDb.getSessionById(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }

  if (session.status !== 'queued' && session.status !== 'planning') {
    throw new Error(`Session is not in a startable state: ${session.status}`)
  }

  // Check if already processing
  if (activeSessions.has(sessionId)) {
    console.log(`[TaskAgent] Session ${sessionId} is already processing`)
    return
  }

  console.log(`[TaskAgent] Starting session ${sessionId}`)

  // Update status to planning
  await agentSessionsDb.updateSessionStatus(sessionId, 'planning')
  emitProgress(sessionId, { type: 'status_change', status: 'planning' })

  const abortController = new AbortController()
  const queue = new MessageQueue()

  activeSessions.set(sessionId, { abortController, queue })

  // Run agent in background
  void runAgent(sessionId, queue, abortController.signal)
}

/**
 * Run the agent for a session
 */
async function runAgent(
  sessionId: string,
  queue: MessageQueue,
  signal: AbortSignal
): Promise<void> {
  try {
    const session = await agentSessionsDb.getSessionById(sessionId)
    if (!session) throw new Error('Session not found')

    const { systemPrompt, workingDirectory } = await buildTaskSystemPrompt(session)

    // Create agent query
    const queryInstance = query({
      prompt: queue as AsyncIterable<SDKUserMessage>,
      options: {
        maxTurns: session.maxTurns,
        cwd: workingDirectory,
        allowedTools: [
          'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
          'Task', 'TaskOutput', 'WebSearch', 'WebFetch',
        ],
        includePartialMessages: true,
        systemPrompt,
      },
    })

    // Send initial prompt to start planning
    const initialPrompt = session.planRequestedChanges
      ? `Please revise the execution plan based on the feedback provided. Then output the plan in the following JSON format:

\`\`\`json
{
  "summary": "Brief overview of the approach",
  "steps": [
    { "id": "step-1", "title": "Step title", "details": "What will be done", "outputs": ["file1.ts"] }
  ],
  "files": [
    { "path": "src/file.ts", "action": "create|modify|delete" }
  ],
  "risks": ["Any potential risks"],
  "assumptions": ["Any assumptions made"]
}
\`\`\``
      : `Please analyze the task and codebase, then create an execution plan. Output the plan in the following JSON format:

\`\`\`json
{
  "summary": "Brief overview of the approach",
  "steps": [
    { "id": "step-1", "title": "Step title", "details": "What will be done", "outputs": ["file1.ts"] }
  ],
  "files": [
    { "path": "src/file.ts", "action": "create|modify|delete" }
  ],
  "risks": ["Any potential risks"],
  "assumptions": ["Any assumptions made"]
}
\`\`\``

    queue.push(initialPrompt)

    // Process stream
    let accumulatedContent = ''
    let planExtracted = false

    for await (const message of queryInstance) {
      if (signal.aborted) {
        console.log(`[TaskAgent] Session ${sessionId} aborted`)
        break
      }

      const msg = message as {
        type?: string
        subtype?: string
        event?: unknown
        total_cost_usd?: number
        duration_ms?: number
      }

      // Handle stream events
      if (msg.type === 'stream_event') {
        const event = msg.event as {
          type?: string
          index?: number
          content_block?: {
            type?: string
            id?: string
            name?: string
          }
          delta?: {
            type?: string
            text?: string
            partial_json?: string
          }
        }

        // Tool use events
        if (event?.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          emitProgress(sessionId, {
            type: 'tool_use',
            toolName: event.content_block.name,
            toolId: event.content_block.id,
          })
        }

        // Text content
        if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          accumulatedContent += event.delta.text || ''
          emitProgress(sessionId, {
            type: 'message',
            content: event.delta.text,
          })
        }
      }

      // Handle result
      if (msg.type === 'result') {
        // Try to extract plan from accumulated content
        if (!planExtracted && accumulatedContent.includes('```json')) {
          const plan = extractPlanFromContent(accumulatedContent)
          if (plan) {
            planExtracted = true
            await agentSessionsDb.savePlan(sessionId, plan)
            emitProgress(sessionId, {
              type: 'plan_ready',
              plan,
              status: 'awaiting_approval',
            })
            console.log(`[TaskAgent] Plan saved for session ${sessionId}`)
          }
        }

        emitProgress(sessionId, {
          type: 'result',
          success: msg.subtype === 'success',
          cost: msg.total_cost_usd,
          duration: msg.duration_ms,
        })
      }

      // Update heartbeat
      await agentSessionsDb.updateHeartbeat(sessionId)
    }

    // Clean up
    activeSessions.delete(sessionId)

  } catch (error) {
    console.error(`[TaskAgent] Error in session ${sessionId}:`, error)
    await agentSessionsDb.updateSessionStatus(
      sessionId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
    emitProgress(sessionId, {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    activeSessions.delete(sessionId)
  }
}

/**
 * Extract execution plan from agent response
 */
function extractPlanFromContent(content: string): ExecutionPlan | null {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1])

      // Validate required fields
      if (parsed.summary && Array.isArray(parsed.steps) && Array.isArray(parsed.files)) {
        return {
          summary: parsed.summary,
          steps: parsed.steps.map((s: { id?: string; title: string; details: string; outputs?: string[] }, i: number) => ({
            id: s.id || `step-${i + 1}`,
            title: s.title,
            details: s.details,
            outputs: s.outputs || [],
          })),
          files: parsed.files.map((f: { path: string; action: string }) => ({
            path: f.path,
            action: f.action as 'create' | 'modify' | 'delete',
          })),
          risks: parsed.risks || [],
          assumptions: parsed.assumptions || [],
          openQuestions: parsed.openQuestions || [],
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Continue execution after plan approval
 */
export async function continueAfterApproval(sessionId: string): Promise<void> {
  const session = await agentSessionsDb.getSessionById(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status !== 'executing') throw new Error('Session is not executing')

  const activeSession = activeSessions.get(sessionId)
  if (!activeSession) {
    // Need to restart the agent session
    console.log(`[TaskAgent] Restarting session ${sessionId} for execution`)

    const abortController = new AbortController()
    const queue = new MessageQueue()
    activeSessions.set(sessionId, { abortController, queue })

    void runExecution(sessionId, session, queue, abortController.signal)
  } else {
    // Send continue message to existing queue
    activeSession.queue.push('The plan has been approved. Please proceed with execution.')
  }
}

/**
 * Run the execution phase of an approved plan
 */
async function runExecution(
  sessionId: string,
  session: AgentSession,
  queue: MessageQueue,
  signal: AbortSignal
): Promise<void> {
  try {
    const { systemPrompt, workingDirectory } = await buildTaskSystemPrompt(session)
    const plan = session.plan as ExecutionPlan

    // Create agent query
    const queryInstance = query({
      prompt: queue as AsyncIterable<SDKUserMessage>,
      options: {
        maxTurns: session.maxTurns - session.currentTurn,
        cwd: workingDirectory,
        allowedTools: [
          'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
          'Task', 'TaskOutput', 'WebSearch', 'WebFetch',
        ],
        includePartialMessages: true,
        systemPrompt,
      },
    })

    // Send execution prompt with the approved plan
    const executionPrompt = `Your plan has been approved. Here is the plan:

${plan.summary}

Steps:
${plan.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.details}`).join('\n')}

Please execute each step carefully. After completing each step, briefly report what was done.
Start with step 1 now.`

    queue.push(executionPrompt)

    // Process stream
    for await (const message of queryInstance) {
      if (signal.aborted) break

      const msg = message as {
        type?: string
        subtype?: string
        event?: unknown
        total_cost_usd?: number
        duration_ms?: number
      }

      // Handle stream events
      if (msg.type === 'stream_event') {
        const event = msg.event as {
          type?: string
          content_block?: { type?: string; id?: string; name?: string }
          delta?: { type?: string; text?: string }
        }

        if (event?.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          emitProgress(sessionId, {
            type: 'tool_use',
            toolName: event.content_block.name,
            toolId: event.content_block.id,
          })
        }

        if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          emitProgress(sessionId, {
            type: 'message',
            content: event.delta.text,
          })
        }
      }

      // Handle result
      if (msg.type === 'result') {
        const success = msg.subtype === 'success'

        await agentSessionsDb.updateSessionStatus(
          sessionId,
          success ? 'completed' : 'failed'
        )

        // Update task status if successful
        if (success && session.taskId) {
          await tasksDb.updateTask(session.taskId, { status: 'completed' })
        }

        emitProgress(sessionId, {
          type: 'result',
          success,
          cost: msg.total_cost_usd,
          duration: msg.duration_ms,
          status: success ? 'completed' : 'failed',
        })
      }

      // Increment turn and heartbeat
      await agentSessionsDb.incrementTurn(sessionId)
    }

    activeSessions.delete(sessionId)

  } catch (error) {
    console.error(`[TaskAgent] Execution error in session ${sessionId}:`, error)
    await agentSessionsDb.updateSessionStatus(
      sessionId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
    emitProgress(sessionId, {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    activeSessions.delete(sessionId)
  }
}

/**
 * Stop a running session
 */
export function stopSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.abortController.abort()
    session.queue.close()
    activeSessions.delete(sessionId)
    return true
  }
  return false
}

/**
 * Check if a session is currently processing
 */
export function isSessionProcessing(sessionId: string): boolean {
  return activeSessions.has(sessionId)
}

/**
 * Queue processor - polls for new sessions and starts them
 */
let processorInterval: ReturnType<typeof setInterval> | null = null

export function startQueueProcessor(intervalMs: number = 5000): void {
  if (processorInterval) return

  console.log('[TaskAgent] Starting queue processor')

  processorInterval = setInterval(async () => {
    try {
      const queuedSessions = await agentSessionsDb.getQueuedSessions()

      for (const session of queuedSessions) {
        if (!activeSessions.has(session.id)) {
          console.log(`[TaskAgent] Found queued session ${session.id}, starting...`)
          await startSession(session.id)
          // Only start one at a time to manage resources
          break
        }
      }
    } catch (error) {
      console.error('[TaskAgent] Queue processor error:', error)
    }
  }, intervalMs)
}

export function stopQueueProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval)
    processorInterval = null
    console.log('[TaskAgent] Queue processor stopped')
  }
}
