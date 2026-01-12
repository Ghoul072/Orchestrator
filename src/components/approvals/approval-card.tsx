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
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import { FileChanges, parseGitDiff } from '~/components/diff/file-changes'

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
  isLoading?: boolean
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
  isLoading = false,
  className,
}: ApprovalCardProps) {
  const [diffExpanded, setDiffExpanded] = useState(false)
  const action = actionConfig[approval.actionType]
  const status = statusConfig[approval.status]
  const ActionIcon = action.icon
  const StatusIcon = status.icon

  // Parse diff content into file changes for proper rendering
  const fileChanges = approval.diffContent ? parseGitDiff(approval.diffContent) : []

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
              <div className="mt-2 max-h-[400px] overflow-auto rounded-md border">
                <FileChanges files={fileChanges} defaultExpanded={false} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {approval.status === 'pending' && (onApprove || onReject) && (
        <CardFooter className="gap-2 pt-2">
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
        </CardFooter>
      )}
    </Card>
  )
}
