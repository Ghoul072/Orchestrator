import { queryOptions } from '@tanstack/react-query'
import {
  listApprovals,
  getApproval,
  getPendingApprovalsCount,
} from '~/server/functions/approvals'

/**
 * Query options for listing approvals
 */
export const approvalsQueryOptions = (options?: {
  taskId?: string
  status?: 'pending' | 'approved' | 'rejected'
}) =>
  queryOptions({
    queryKey: ['approvals', options],
    queryFn: () =>
      listApprovals({
        data: {
          taskId: options?.taskId,
          status: options?.status,
        },
      }),
  })

/**
 * Query options for a single approval
 */
export const approvalQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['approval', id],
    queryFn: () => getApproval({ data: { id } }),
    enabled: !!id,
  })

/**
 * Query options for pending approvals count
 */
export const pendingApprovalsCountQueryOptions = () =>
  queryOptions({
    queryKey: ['approvals', 'pending-count'],
    queryFn: () => getPendingApprovalsCount({}),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
