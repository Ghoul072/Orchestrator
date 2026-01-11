import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApprovalList } from '~/components/approvals/approval-list'
import { approvalsQueryOptions } from '~/queries/approvals'
import { approveApproval, rejectApproval } from '~/server/functions/approvals'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

export const Route = createFileRoute('/_layout/projects/$projectId/approvals')({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const queryClient = useQueryClient()

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading: pendingLoading } = useQuery(
    approvalsQueryOptions({ status: 'pending' })
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

  const isLoading = approveMutation.isPending || rejectMutation.isPending

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
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <ApprovalList
            approvals={pendingApprovals}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            isLoading={isLoading || pendingLoading}
            emptyMessage="No pending approvals"
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
