import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as approvalsDb from '~/server/db/approvals'

// =============================================================================
// SCHEMAS
// =============================================================================

const ApprovalIdSchema = z.object({
  id: z.string().uuid(),
})

const ApproveApprovalSchema = z.object({
  id: z.string().uuid(),
  githubPrUrl: z.string().url().optional(),
})

const ListApprovalsSchema = z.object({
  taskId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'changes_requested']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

const ChangeRequestSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  endLineNumber: z.number().optional(), // For range/block comments
  lineType: z.enum(['add', 'remove', 'context']),
  content: z.string(),
  isChangeRequest: z.boolean(),
  createdAt: z.string(),
})

const RequestChangesSchema = z.object({
  id: z.string().uuid(),
  changeRequests: z.array(ChangeRequestSchema).min(1),
})

const ResubmitApprovalSchema = z.object({
  id: z.string().uuid(),
  newDiffContent: z.string().optional(),
})

const CreateApprovalSchema = z.object({
  taskId: z.string().uuid().optional(),
  agentSessionId: z.string().uuid().optional(),
  actionType: z.enum(['file_delete', 'git_push', 'git_force_push']),
  actionDescription: z.string().min(1),
  diffContent: z.string().optional(),
  filesAffected: z.array(z.string()).optional(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * List approvals with optional filters
 */
export const listApprovals = createServerFn({ method: 'POST' })
  .inputValidator(ListApprovalsSchema)
  .handler(async ({ data }) => {
    return approvalsDb.getApprovals({
      taskId: data.taskId,
      status: data.status,
      limit: data.limit,
      offset: data.offset,
    })
  })

/**
 * Get pending approvals count
 */
export const getPendingApprovalsCount = createServerFn({ method: 'POST' })
  .handler(async () => {
    const count = await approvalsDb.countPendingApprovals()
    return { count }
  })

/**
 * Get a single approval
 */
export const getApproval = createServerFn({ method: 'POST' })
  .inputValidator(ApprovalIdSchema)
  .handler(async ({ data }) => {
    const approval = await approvalsDb.getApprovalById(data.id)
    if (!approval) {
      throw new Error('Approval not found')
    }
    return approval
  })

/**
 * Create a new approval request
 */
export const createApproval = createServerFn({ method: 'POST' })
  .inputValidator(CreateApprovalSchema)
  .handler(async ({ data }) => {
    return approvalsDb.createApproval({
      taskId: data.taskId,
      agentSessionId: data.agentSessionId,
      actionType: data.actionType,
      actionDescription: data.actionDescription,
      diffContent: data.diffContent,
      filesAffected: data.filesAffected,
    })
  })

/**
 * Approve an approval request
 */
export const approveApproval = createServerFn({ method: 'POST' })
  .inputValidator(ApproveApprovalSchema)
  .handler(async ({ data }) => {
    const approval = await approvalsDb.approveApproval(data.id, data.githubPrUrl)
    if (!approval) {
      throw new Error('Approval not found or already resolved')
    }
    return approval
  })

/**
 * Reject an approval request
 */
export const rejectApproval = createServerFn({ method: 'POST' })
  .inputValidator(ApprovalIdSchema)
  .handler(async ({ data }) => {
    const approval = await approvalsDb.rejectApproval(data.id)
    if (!approval) {
      throw new Error('Approval not found or already resolved')
    }
    return approval
  })

/**
 * Request changes on an approval
 */
export const requestChanges = createServerFn({ method: 'POST' })
  .inputValidator(RequestChangesSchema)
  .handler(async ({ data }) => {
    const approval = await approvalsDb.requestChangesOnApproval(data.id, data.changeRequests)
    if (!approval) {
      throw new Error('Approval not found or already resolved')
    }
    return approval
  })

/**
 * Resubmit an approval after addressing change requests
 */
export const resubmitApproval = createServerFn({ method: 'POST' })
  .inputValidator(ResubmitApprovalSchema)
  .handler(async ({ data }) => {
    const approval = await approvalsDb.resubmitApproval(data.id, data.newDiffContent)
    if (!approval) {
      throw new Error('Approval not found or not in changes_requested status')
    }
    return approval
  })

/**
 * Delete an approval
 */
export const deleteApproval = createServerFn({ method: 'POST' })
  .inputValidator(ApprovalIdSchema)
  .handler(async ({ data }) => {
    const deleted = await approvalsDb.deleteApproval(data.id)
    if (!deleted) {
      throw new Error('Approval not found')
    }
    return { success: true }
  })
