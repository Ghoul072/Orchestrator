import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

// Message types for the queue (simplified for internal use)
interface QueueMessage {
  type: 'user'
  message: { role: 'user'; content: string }
  parent_tool_use_id: string | null
  session_id: string
}

// Stream response types sent to client
export interface StreamResponse {
  type:
    | 'connected'
    | 'assistant_message'
    | 'tool_use'
    | 'tool_result'
    | 'result'
    | 'error'
    | 'system'
  content?: string
  toolName?: string
  toolId?: string
  toolUseId?: string
  toolInput?: unknown
  toolResult?: unknown
  toolResultIsError?: boolean
  partial?: boolean
  success?: boolean
  error?: string
  sessionId?: string
  cost?: number
  duration?: number
}

// Message queue for multi-turn conversations
class MessageQueue {
  private messages: QueueMessage[] = []
  private waiting: ((msg: QueueMessage) => void) | null = null
  private closed = false
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  push(content: string) {
    const msg: QueueMessage = {
      type: 'user',
      message: { role: 'user', content },
      parent_tool_use_id: null,
      session_id: this.sessionId,
    }

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
        const msg = await new Promise<QueueMessage>((resolve) => {
          this.waiting = resolve
        })
        yield msg as unknown as SDKUserMessage
      }
    }
  }

  close() {
    this.closed = true
    // Resolve any waiting promise to unblock the iterator
    if (this.waiting) {
      this.waiting({
        type: 'user',
        message: { role: 'user', content: '' },
        parent_tool_use_id: null,
        session_id: this.sessionId,
      })
      this.waiting = null
    }
  }
}

// Options for creating an agent session
export interface AgentSessionOptions {
  systemPrompt?: string
  additionalDirectories?: string[]
  maxTurns?: number
  taskId?: string
  projectId?: string
}

// Individual agent session
export class AgentSession {
  private queue: MessageQueue
  private outputIterator: AsyncIterator<unknown> | null = null
  private closed = false
  public readonly id: string
  public readonly taskId?: string
  public readonly projectId?: string

  constructor(
    id: string,
    workingDirectory: string,
    options: AgentSessionOptions = {}
  ) {
    this.id = id
    this.queue = new MessageQueue(id)
    this.taskId = options.taskId
    this.projectId = options.projectId

    const additionalDirectories = (options.additionalDirectories ?? []).filter(
      (directory) => directory && directory.trim().length > 0
    )

    const queryInstance = query({
      prompt: this.queue as AsyncIterable<SDKUserMessage>,
      options: {
        maxTurns: options.maxTurns ?? 100,
        cwd: workingDirectory,
        allowedTools: [
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'Task',
          'TaskOutput',
          'WebSearch',
          'WebFetch',
        ],
        includePartialMessages: true,
        ...(additionalDirectories.length > 0 ? { additionalDirectories } : {}),
        ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      },
    })

    this.outputIterator = queryInstance[Symbol.asyncIterator]()
  }

  sendMessage(content: string) {
    if (!this.closed) {
      this.queue.push(content)
    }
  }

  async *getOutputStream(): AsyncGenerator<StreamResponse> {
    if (!this.outputIterator) {
      yield { type: 'error', error: 'No output iterator available' }
      return
    }

    // Track tool use buffers for streaming JSON input
    const toolUseBuffers = new Map<
      number,
      { id: string; name: string; inputJson: string }
    >()

    try {
      for await (const message of {
        [Symbol.asyncIterator]: () => this.outputIterator!,
      }) {
        if (this.closed) break

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
              text?: string
              tool_use_id?: string
              content?: unknown
              is_error?: boolean
            }
            delta?: {
              type?: string
              text?: string
              partial_json?: string
            }
          }

          // Tool result
          if (
            event?.type === 'content_block_start' &&
            event.content_block?.type === 'tool_result'
          ) {
            yield {
              type: 'tool_result',
              toolUseId: event.content_block.tool_use_id,
              toolResult: event.content_block.content,
              toolResultIsError: Boolean(event.content_block.is_error),
            }
          }

          // Tool use start
          if (
            event?.type === 'content_block_start' &&
            event.content_block?.type === 'tool_use'
          ) {
            const toolId = event.content_block.id || crypto.randomUUID()
            const toolName = event.content_block.name || 'unknown'
            const index = event.index ?? 0

            toolUseBuffers.set(index, {
              id: toolId,
              name: toolName,
              inputJson: '',
            })

            yield { type: 'tool_use', toolId, toolName }
          }

          // Streaming JSON input for tools
          if (
            event?.type === 'content_block_delta' &&
            event.delta?.type === 'input_json_delta'
          ) {
            const index = event.index ?? 0
            const buffer = toolUseBuffers.get(index)
            if (buffer && event.delta.partial_json) {
              buffer.inputJson += event.delta.partial_json
              const parsed = tryParseToolInput(buffer.inputJson)
              if (parsed) {
                yield { type: 'tool_use', toolId: buffer.id, toolInput: parsed }
              }
            }
          }

          // Text content
          if (
            event?.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta'
          ) {
            yield {
              type: 'assistant_message',
              content: event.delta.text,
              partial: true,
            }
          }

          // Tool use stop - send final input
          if (event?.type === 'content_block_stop') {
            const index = event.index ?? 0
            const buffer = toolUseBuffers.get(index)
            if (buffer) {
              const parsed = tryParseToolInput(buffer.inputJson)
              if (parsed) {
                yield {
                  type: 'tool_use',
                  toolId: buffer.id,
                  toolName: buffer.name,
                  toolInput: parsed,
                }
              }
              toolUseBuffers.delete(index)
            }
          }
        }

        // Handle assistant messages
        if (msg.type === 'assistant') {
          const assistantMsg = message as {
            message?: { content?: Array<{ type: string; text?: string }> }
          }
          const textContent = assistantMsg.message?.content?.find(
            (c) => c.type === 'text'
          )
          if (textContent?.text) {
            yield { type: 'assistant_message', content: textContent.text }
          }
        }

        // Handle final result
        if (msg.type === 'result') {
          yield {
            type: 'result',
            success: msg.subtype === 'success',
            cost: msg.total_cost_usd,
            duration: msg.duration_ms,
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream error',
      }
    }
  }

  close() {
    this.closed = true
    this.queue.close()
  }
}

// Try to parse partial JSON input
function tryParseToolInput(json: string): unknown | null {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Agent manager singleton
export class AgentManager {
  private sessions = new Map<string, AgentSession>()

  createSession(
    workingDirectory: string,
    options?: AgentSessionOptions
  ): string {
    const id = crypto.randomUUID()
    const session = new AgentSession(id, workingDirectory, options)
    this.sessions.set(id, session)
    console.log(`[AgentManager] Created session ${id}`)
    return id
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id)
  }

  sendMessage(id: string, content: string): void {
    const session = this.sessions.get(id)
    if (!session) {
      throw new Error(`Session ${id} not found`)
    }
    session.sendMessage(content)
  }

  async *getOutputStream(id: string): AsyncGenerator<StreamResponse> {
    const session = this.sessions.get(id)
    if (!session) {
      throw new Error(`Session ${id} not found`)
    }
    yield* session.getOutputStream()
  }

  destroySession(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.close()
      this.sessions.delete(id)
      console.log(`[AgentManager] Destroyed session ${id}`)
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys())
  }
}

// Export singleton instance
export const agentManager = new AgentManager()
