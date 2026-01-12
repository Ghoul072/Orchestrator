import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  TrashIcon,
  GitBranchIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChatCircleIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import { FileChangesWithComments, parseGitDiff } from '~/components/diff/file-changes'
import {
  useDiffLineComments,
  CommentsSummary,
  type DiffLineComment,
} from '~/components/diff/diff-line-comments'

interface ApprovalCardProps {
  approval: {
    id: string
    actionType: 'file_delete' | 'git_push' | 'git_force_push'
    actionDescription: string
    diffContent?: string | null
    filesAffected?: string[] | null
    status: 'pending' | 'approved' | 'rejected'
    createdAt: Date | string
  }
  onApprove?: () => void
  onReject?: () => void
  onRequestChanges?: (comments: DiffLineComment[]) => void
  isLoading?: boolean
  enableComments?: boolean
  className?: string
}

const actionConfig = {
  file_delete: {
    icon: TrashIcon,
    label: 'File Deletion',
    className: 'bg-red-500/10 text-red-600',
  },
  git_push: {
    icon: GitBranchIcon,
    label: 'Git Push',
    className: 'bg-blue-500/10 text-blue-600',
  },
  git_force_push: {
    icon: WarningCircleIcon,
    label: 'Force Push',
    className: 'bg-orange-500/10 text-orange-600',
  },
}

const statusConfig = {
  pending: {
    icon: ClockIcon,
    label: 'Pending',
    className: 'bg-yellow-500/10 text-yellow-600',
  },
  approved: {
    icon: CheckCircleIcon,
    label: 'Approved',
    className: 'bg-green-500/10 text-green-600',
  },
  rejected: {
    icon: XCircleIcon,
    label: 'Rejected',
    className: 'bg-red-500/10 text-red-600',
  },
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onRequestChanges,
  isLoading = false,
  enableComments = false,
  className,
}: ApprovalCardProps) {
  const [diffExpanded, setDiffExpanded] = useState(false)
  const action = actionConfig[approval.actionType]
  const status = statusConfig[approval.status]
  const ActionIcon = action.icon
  const StatusIcon = status.icon

  // Comment management
  const { comments, addComment, removeComment, clearComments, hasChangeRequests } =
    useDiffLineComments()

  // Parse diff content into file changes for proper rendering
  const fileChanges = approval.diffContent ? parseGitDiff(approval.diffContent) : []

  const handleRequestChanges = () => {
    if (onRequestChanges && comments.length > 0) {
      onRequestChanges(comments)
    }
  }

  return (
    <Card className={cn('transition-all', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn('gap-1', action.className)}>
              <ActionIcon className="h-3 w-3" />
              {action.label}
            </Badge>
            <Badge className={cn('gap-1', status.className)}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(approval.createdAt).toLocaleString()}
          </span>
        </div>
        <CardTitle className="mt-2 text-sm font-medium">
          {approval.actionDescription}
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-2">
        {approval.filesAffected && approval.filesAffected.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Files Affected:
            </p>
            <div className="flex flex-wrap gap-1">
              {approval.filesAffected.map((file) => (
                <Badge key={file} variant="outline" className="text-xs">
                  {file}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {approval.diffContent && fileChanges.length > 0 && (
          <Collapsible open={diffExpanded} onOpenChange={setDiffExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 px-2"
              >
                {diffExpanded ? (
                  <CaretDownIcon className="h-4 w-4" />
                ) : (
                  <CaretRightIcon className="h-4 w-4" />
                )}
                View Diff ({fileChanges.length} file{fileChanges.length !== 1 ? 's' : ''})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {enableComments && approval.status === 'pending' && (
                  <CommentsSummary
                    comments={comments}
                    onClear={clearComments}
                  />
                )}
                <div className="max-h-[400px] overflow-auto rounded-md border">
                  <FileChangesWithComments
                    files={fileChanges}
                    defaultExpanded={false}
                    comments={comments}
                    onAddComment={enableComments && approval.status === 'pending' ? addComment : undefined}
                    onRemoveComment={enableComments && approval.status === 'pending' ? removeComment : undefined}
                    enableComments={enableComments && approval.status === 'pending'}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {approval.status === 'pending' && (onApprove || onReject || onRequestChanges) && (
        <CardFooter className="flex-col gap-2 pt-2">
          <div className="flex w-full gap-2">
            {onReject && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={isLoading}
                className="flex-1"
              >
                <XCircleIcon className="mr-2 h-4 w-4" />
                Reject
              </Button>
            )}
            {onRequestChanges && enableComments && hasChangeRequests && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestChanges}
                disabled={isLoading || comments.length === 0}
                className="flex-1 border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
              >
                <ChatCircleIcon className="mr-2 h-4 w-4" />
                Request Changes ({comments.filter((c) => c.isChangeRequest).length})
              </Button>
            )}
            {onApprove && (
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isLoading}
                className="flex-1"
              >
                <CheckCircleIcon className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
