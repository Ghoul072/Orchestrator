import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from '@phosphor-icons/react'
import { meetingsQueryOptions } from '~/queries/meetings'
import { projectQueryOptions } from '~/queries/projects'
import { createMeeting } from '~/server/functions/meetings'
import { MeetingList } from '~/components/meetings/meeting-list'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

export const Route = createFileRoute(
  '/_layout/projects/$projectId/meetings'
)({
  component: MeetingsPage,
})

function MeetingsPage() {
  const params = Route.useParams() as { projectId: string }
  const projectId = params.projectId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: meetings, isLoading } = useQuery(
    meetingsQueryOptions(projectId)
  )

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      createMeeting({
        data: {
          projectId,
          title,
          date: new Date().toISOString(),
        },
      }),
    onSuccess: (meeting: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['meetings', projectId] })
      setCreateDialogOpen(false)
      setNewMeetingTitle('')
      // Navigate to the new meeting
      void navigate({
        to: '/projects/$projectId/meetings/$meetingId' as const,
        params: { projectId, meetingId: meeting.id },
      })
    },
  })

  const handleCreateMeeting = () => {
    if (!newMeetingTitle.trim()) return
    createMutation.mutate(newMeetingTitle.trim())
  }

  const handleMeetingClick = (meetingId: string) => {
    void navigate({
      to: '/projects/$projectId/meetings/$meetingId' as const,
      params: { projectId, meetingId },
    })
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meeting Notes</h1>
          {project && (
            <p className="text-sm text-muted-foreground">{project.name}</p>
          )}
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Meeting
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <MeetingList
        meetings={(meetings || []).map((m: { id: string; title: string; date: Date | string; attendees?: string[] | null; status: string; summary?: string | null }) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          attendees: m.attendees ?? [],
          status: m.status as 'draft' | 'finalized',
          summary: m.summary,
        }))}
        onMeetingClick={handleMeetingClick}
        onCreateMeeting={() => setCreateDialogOpen(true)}
      />
      )}

      {/* Create Meeting Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Meeting</DialogTitle>
            <DialogDescription>
              Create a new meeting note to capture discussions and action items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              placeholder="Meeting title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateMeeting()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMeeting}
              disabled={!newMeetingTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
