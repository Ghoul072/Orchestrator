import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meetingQueryOptions } from '~/queries/meetings'
import { projectQueryOptions } from '~/queries/projects'
import {
  updateMeeting,
  deleteMeeting,
  generateTasksFromMeeting,
  updateTasksFromMeeting,
} from '~/server/functions/meetings'
import { toast } from 'sonner'
import { MeetingEditor } from '~/components/meetings/meeting-editor'
import { Skeleton } from '~/components/ui/skeleton'
import { Button } from '~/components/ui/button'
import { ArrowLeftIcon } from '@phosphor-icons/react'

interface MeetingData {
  id: string
  title: string
  date: Date | string
  attendees: string[] | null
  content: string | null
  summary: string | null
  status: string
}

export const Route = createFileRoute(
  '/_layout/projects/$projectId/meetings/$meetingId'
)({
  component: MeetingDetailPage,
})

function MeetingDetailPage() {
  const params = Route.useParams() as { projectId: string; meetingId: string }
  const projectId = params.projectId
  const meetingId = params.meetingId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: meeting, isLoading } = useQuery(meetingQueryOptions(meetingId)) as { data: MeetingData | undefined; isLoading: boolean }

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string
      date: string
      attendees: string[]
      content: string
      status: 'draft' | 'finalized'
    }) =>
      updateMeeting({
        data: {
          id: meetingId,
          title: data.title,
          date: data.date,
          attendees: data.attendees,
          content: data.content,
          status: data.status,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
      queryClient.invalidateQueries({ queryKey: ['meetings', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeeting({ data: { id: meetingId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', projectId] })
      void navigate({
        to: '/projects/$projectId/meetings' as const,
        params: { projectId },
      })
    },
  })

  const generateTasksMutation = useMutation({
    mutationFn: () =>
      generateTasksFromMeeting({ data: { meetingId, projectId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
      toast.success(
        `Successfully created ${result.tasksCreated} task${result.tasksCreated === 1 ? '' : 's'} from meeting notes.`
      )
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate tasks'
      )
    },
  })

  const updateTasksMutation = useMutation({
    mutationFn: () =>
      updateTasksFromMeeting({ data: { meetingId, projectId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
      if (result.tasksUpdated === 0) {
        toast.info('No tasks needed updates based on this meeting.')
      } else {
        toast.success(
          `Successfully updated ${result.tasksUpdated} task${result.tasksUpdated === 1 ? '' : 's'} from meeting notes.`
        )
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update tasks'
      )
    },
  })

  const handleBack = () => {
    void navigate({
      to: '/projects/$projectId/meetings' as const,
      params: { projectId },
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full" />
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h2 className="text-lg font-medium">Meeting not found</h2>
        <p className="mb-4 text-muted-foreground">
          The meeting you're looking for doesn't exist.
        </p>
        <Button onClick={handleBack}>Back to Meetings</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back
        </Button>
        <span className="text-sm text-muted-foreground">
          {project?.name} / Meetings
        </span>
      </div>

      {/* Editor */}
      <MeetingEditor
        initialData={{
          title: meeting.title,
          date:
            typeof meeting.date === 'string'
              ? meeting.date.split('T')[0]
              : new Date(meeting.date).toISOString().split('T')[0],
          attendees: meeting.attendees ?? [],
          content: meeting.content ?? '',
          status: meeting.status as 'draft' | 'finalized',
          summary: meeting.summary ?? undefined,
        }}
        onSave={(data) => updateMutation.mutate(data)}
        onDelete={() => deleteMutation.mutate()}
        onGenerateTasks={() => generateTasksMutation.mutate()}
        onUpdateTasks={() => updateTasksMutation.mutate()}
        isLoading={updateMutation.isPending || deleteMutation.isPending}
        isGenerating={generateTasksMutation.isPending}
        isUpdating={updateTasksMutation.isPending}
        className="flex-1"
      />
    </div>
  )
}
