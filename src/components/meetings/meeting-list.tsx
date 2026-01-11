import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  CalendarIcon,
  UsersIcon,
  PlusIcon,
  NotePencilIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface Meeting {
  id: string
  title: string
  date: Date | string
  attendees: string[]
  status: 'draft' | 'finalized'
  summary?: string | null
}

interface MeetingListProps {
  meetings: Meeting[]
  onMeetingClick?: (meetingId: string) => void
  onCreateMeeting?: () => void
  className?: string
}

export function MeetingList({
  meetings,
  onMeetingClick,
  onCreateMeeting,
  className,
}: MeetingListProps) {
  if (meetings.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <NotePencilIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">No meetings yet</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Create meeting notes to track discussions and action items.
          </p>
          <Button onClick={onCreateMeeting}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Meeting
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          onClick={() => onMeetingClick?.(meeting.id)}
        />
      ))}
    </div>
  )
}

function MeetingCard({
  meeting,
  onClick,
}: {
  meeting: Meeting
  onClick?: () => void
}) {
  const date =
    typeof meeting.date === 'string' ? new Date(meeting.date) : meeting.date

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{meeting.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                {date.toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {meeting.attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <UsersIcon className="h-4 w-4" />
                  {meeting.attendees.length} attendee
                  {meeting.attendees.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <Badge
            variant={meeting.status === 'finalized' ? 'default' : 'secondary'}
            className={cn(
              meeting.status === 'finalized' &&
                'bg-green-500/10 text-green-600 hover:bg-green-500/20'
            )}
          >
            {meeting.status === 'finalized' ? (
              <>
                <CheckCircleIcon className="mr-1 h-3 w-3" weight="fill" />
                Finalized
              </>
            ) : (
              'Draft'
            )}
          </Badge>
        </div>
      </CardHeader>
      {meeting.summary && (
        <CardContent className="pt-0">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {meeting.summary}
          </p>
        </CardContent>
      )}
    </Card>
  )
}
