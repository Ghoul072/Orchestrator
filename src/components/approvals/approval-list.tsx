import { Card, CardContent } from '~/components/ui/card'
import { ApprovalCard } from './approval-card'
import { ShieldCheckIcon } from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import type { DiffLineComment } from '~/components/diff/diff-line-comments'

// Stored change request format (createdAt is serialized as string)
interface StoredChangeRequest {
  id: string
  lineNumber: number
  lineType: 'add' | 'remove' | 'context'
  content: string
  isChangeRequest: boolean
  createdAt: string
}

interface Approval {
  id: string
  actionType: 'file_delete' | 'git_push' | 'git_force_push'
  actionDescription: string
  diffContent?: string | null
  filesAffected?: string[] | null
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested'
  changeRequests?: StoredChangeRequest[] | null
  githubPrUrl?: string | null
  createdAt: Date | string
}

interface ApprovalListProps {
  approvals: Approval[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onRequestChanges?: (id: string, comments: DiffLineComment[]) => void
  onResubmit?: (id: string) => void
  isLoading?: boolean
  emptyMessage?: string
  enableComments?: boolean
  className?: string
}

export function ApprovalList({
  approvals,
  onApprove,
  onReject,
  onRequestChanges,
  onResubmit,
  isLoading = false,
  emptyMessage = 'No pending approvals',
  enableComments = false,
  className,
}: ApprovalListProps) {
  if (approvals.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheckIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">{emptyMessage}</h3>
          <p className="text-center text-sm text-muted-foreground">
            All clear! No actions require your approval.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          onApprove={onApprove ? () => onApprove(approval.id) : undefined}
          onReject={onReject ? () => onReject(approval.id) : undefined}
          onRequestChanges={
            onRequestChanges
              ? (comments) => onRequestChanges(approval.id, comments)
              : undefined
          }
          onResubmit={onResubmit ? () => onResubmit(approval.id) : undefined}
          enableComments={enableComments}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}
