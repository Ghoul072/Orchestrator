import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApprovalList } from '~/components/approvals/approval-list'
import { approvalsQueryOptions } from '~/queries/approvals'
import {
  approveApproval,
  rejectApproval,
  requestChanges,
  resubmitApproval,
} from '~/server/functions/approvals'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { DiffLineComment } from '~/components/diff/diff-line-comments'

export const Route = createFileRoute('/_layout/projects/$projectId/approvals')({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const queryClient = useQueryClient()

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading: pendingLoading } = useQuery(
    approvalsQueryOptions({ status: 'pending' })
  )

  // Fetch changes requested approvals
  const { data: changesRequestedApprovals = [], isLoading: changesLoading } = useQuery(
    approvalsQueryOptions({ status: 'changes_requested' })
  )

  // Fetch all approvals (for history)
  const { data: allApprovals = [], isLoading: allLoading } = useQuery(
    approvalsQueryOptions({})
  )

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveApproval({ data: { id } }),
    onSuccess: () => {
      toast.success('Approval granted')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (error) => {
      toast.error('Failed to approve', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectApproval({ data: { id } }),
    onSuccess: () => {
      toast.success('Approval rejected')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (error) => {
      toast.error('Failed to reject', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Request changes mutation
  const requestChangesMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: DiffLineComment[] }) =>
      requestChanges({
        data: {
          id,
          changeRequests: comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      }),
    onSuccess: () => {
      toast.success('Changes requested', {
        description: 'The agent will be notified to address your feedback.',
      })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (error) => {
      toast.error('Failed to request changes', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Resubmit mutation
  const resubmitMutation = useMutation({
    mutationFn: (id: string) => resubmitApproval({ data: { id } }),
    onSuccess: () => {
      toast.success('Approval resubmitted', {
        description: 'The approval is now pending review.',
      })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (error) => {
      toast.error('Failed to resubmit', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const isLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    requestChangesMutation.isPending ||
    resubmitMutation.isPending

  // Filter approvals that are resolved (approved or rejected)
  const resolvedApprovals = allApprovals.filter(
    (a) => a.status === 'approved' || a.status === 'rejected'
  )

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted-foreground">
          Review and manage pending approval requests for destructive actions
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingApprovals.length > 0 && (
              <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {pendingApprovals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="changes">
            Changes Requested
            {changesRequestedApprovals.length > 0 && (
              <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
                {changesRequestedApprovals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <ApprovalList
            approvals={pendingApprovals}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            onRequestChanges={(id, comments) =>
              requestChangesMutation.mutate({ id, comments })
            }
            enableComments
            isLoading={isLoading || pendingLoading}
            emptyMessage="No pending approvals"
          />
        </TabsContent>

        <TabsContent value="changes" className="mt-4">
          <ApprovalList
            approvals={changesRequestedApprovals}
            onResubmit={(id) => resubmitMutation.mutate(id)}
            isLoading={isLoading || changesLoading}
            emptyMessage="No change requests awaiting action"
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ApprovalList
            approvals={resolvedApprovals}
            isLoading={allLoading}
            emptyMessage="No approval history"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
