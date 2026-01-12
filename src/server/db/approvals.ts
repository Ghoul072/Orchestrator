import { eq, and, desc } from 'drizzle-orm'
import { db } from '~/server/db'
import { approvals, type NewApproval, type Approval } from '~/server/db/schema'

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get pending approvals for a task
 */
export async function getPendingApprovals(taskId?: string): Promise<Approval[]> {
  const conditions = [eq(approvals.status, 'pending')]
  if (taskId) {
    conditions.push(eq(approvals.taskId, taskId))
  }

  return db
    .select()
    .from(approvals)
    .where(and(...conditions))
    .orderBy(desc(approvals.createdAt))
}

/**
 * Get all approvals (with optional filters)
 */
export async function getApprovals(options?: {
  taskId?: string
  status?: 'pending' | 'approved' | 'rejected' | 'changes_requested'
  limit?: number
  offset?: number
}): Promise<Approval[]> {
  const conditions: ReturnType<typeof eq>[] = []

  if (options?.taskId) {
    conditions.push(eq(approvals.taskId, options.taskId))
  }
  if (options?.status) {
    conditions.push(eq(approvals.status, options.status))
  }

  return db
    .select()
    .from(approvals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(approvals.createdAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0)
}

/**
 * Get an approval by ID
 */
export async function getApprovalById(id: string): Promise<Approval | undefined> {
  const [result] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, id))
    .limit(1)
  return result
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new approval request
 */
export async function createApproval(data: NewApproval): Promise<Approval> {
  const [result] = await db.insert(approvals).values(data).returning()
  return result!
}

/**
 * Approve an approval request
 */
export async function approveApproval(
  id: string,
  githubPrUrl?: string
): Promise<Approval | undefined> {
  const [result] = await db
    .update(approvals)
    .set({
      status: 'approved',
      resolvedAt: new Date(),
      ...(githubPrUrl && { githubPrUrl }),
    })
    .where(and(eq(approvals.id, id), eq(approvals.status, 'pending')))
    .returning()
  return result
}

/**
 * Update PR URL for an approval
 */
export async function updateApprovalPrUrl(
  id: string,
  githubPrUrl: string
): Promise<Approval | undefined> {
  const [result] = await db
    .update(approvals)
    .set({ githubPrUrl })
    .where(eq(approvals.id, id))
    .returning()
  return result
}

/**
 * Reject an approval request
 */
export async function rejectApproval(id: string): Promise<Approval | undefined> {
  const [result] = await db
    .update(approvals)
    .set({
      status: 'rejected',
      resolvedAt: new Date(),
    })
    .where(and(eq(approvals.id, id), eq(approvals.status, 'pending')))
    .returning()
  return result
}

/**
 * Request changes on an approval
 */
export interface ChangeRequest {
  id: string
  lineNumber: number
  endLineNumber?: number // For range/block comments
  lineType: 'add' | 'remove' | 'context'
  content: string
  isChangeRequest: boolean
  createdAt: string
}

export async function requestChangesOnApproval(
  id: string,
  changeRequests: ChangeRequest[]
): Promise<Approval | undefined> {
  const [result] = await db
    .update(approvals)
    .set({
      status: 'changes_requested',
      changeRequests,
    })
    .where(and(eq(approvals.id, id), eq(approvals.status, 'pending')))
    .returning()
  return result
}

/**
 * Resubmit an approval after addressing change requests
 * Resets status to pending and clears change requests
 */
export async function resubmitApproval(
  id: string,
  newDiffContent?: string
): Promise<Approval | undefined> {
  const [result] = await db
    .update(approvals)
    .set({
      status: 'pending',
      changeRequests: null,
      ...(newDiffContent && { diffContent: newDiffContent }),
    })
    .where(and(eq(approvals.id, id), eq(approvals.status, 'changes_requested')))
    .returning()
  return result
}

/**
 * Delete an approval
 */
export async function deleteApproval(id: string): Promise<boolean> {
  const result = await db.delete(approvals).where(eq(approvals.id, id)).returning()
  return result.length > 0
}

/**
 * Count pending approvals
 */
export async function countPendingApprovals(): Promise<number> {
  const result = await db
    .select()
    .from(approvals)
    .where(eq(approvals.status, 'pending'))
  return result.length
}
