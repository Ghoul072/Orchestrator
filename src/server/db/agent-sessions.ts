import { eq, desc, and } from 'drizzle-orm'
import { db } from '~/server/db'
import { agentSessions, type NewAgentSession, type AgentSession } from '~/server/db/schema'

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all agent sessions for a task
 */
export async function getSessionsByTask(taskId: string): Promise<AgentSession[]> {
  return db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.taskId, taskId))
    .orderBy(desc(agentSessions.createdAt))
}

/**
 * Get active sessions for a task
 */
export async function getActiveSessionByTask(taskId: string): Promise<AgentSession | undefined> {
  const [result] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.taskId, taskId),
        eq(agentSessions.status, 'executing')
      )
    )
    .orderBy(desc(agentSessions.createdAt))
    .limit(1)
  return result
}

/**
 * Get an agent session by ID
 */
export async function getSessionById(id: string): Promise<AgentSession | undefined> {
  const [result] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, id))
    .limit(1)
  return result
}

/**
 * Get all active sessions
 */
export async function getActiveSessions(): Promise<AgentSession[]> {
  return db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.status, 'executing'))
    .orderBy(desc(agentSessions.createdAt))
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new agent session
 */
export async function createSession(data: NewAgentSession): Promise<AgentSession> {
  const [result] = await db.insert(agentSessions).values(data).returning()
  return result!
}

/**
 * Update an agent session
 */
export async function updateSession(
  id: string,
  data: Partial<Omit<AgentSession, 'id' | 'createdAt'>>
): Promise<AgentSession | undefined> {
  const [result] = await db
    .update(agentSessions)
    .set(data)
    .where(eq(agentSessions.id, id))
    .returning()
  return result
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  id: string,
  status: AgentSession['status'],
  errorMessage?: string
): Promise<AgentSession | undefined> {
  const updates: Partial<AgentSession> = { status }

  if (status === 'executing') {
    updates.startedAt = new Date()
  }

  if (status === 'completed' || status === 'failed' || status === 'timeout') {
    updates.completedAt = new Date()
  }

  if (errorMessage) {
    updates.errorMessage = errorMessage
  }

  return updateSession(id, updates)
}

/**
 * Update session heartbeat
 */
export async function updateHeartbeat(id: string): Promise<AgentSession | undefined> {
  return updateSession(id, {
    lastHeartbeat: new Date(),
  })
}

/**
 * Increment turn count
 */
export async function incrementTurn(id: string): Promise<AgentSession | undefined> {
  const session = await getSessionById(id)
  if (!session) return undefined

  return updateSession(id, {
    currentTurn: session.currentTurn + 1,
    lastHeartbeat: new Date(),
  })
}

/**
 * Delete an agent session
 */
export async function deleteSession(id: string): Promise<boolean> {
  const result = await db.delete(agentSessions).where(eq(agentSessions.id, id)).returning()
  return result.length > 0
}
