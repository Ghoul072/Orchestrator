import { queryOptions } from '@tanstack/react-query'
import { listMeetings, getMeeting, getMeetingTaskLinks } from '~/server/functions/meetings'

export const meetingsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ['meetings', projectId],
    queryFn: () => listMeetings({ data: { projectId } }),
    enabled: !!projectId,
  })

export const meetingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['meeting', id],
    queryFn: () => getMeeting({ data: { id } }),
    enabled: !!id,
  })

export const meetingTaskLinksQueryOptions = (meetingId: string) =>
  queryOptions({
    queryKey: ['meeting', meetingId, 'taskLinks'],
    queryFn: () => getMeetingTaskLinks({ data: { id: meetingId } }),
    enabled: !!meetingId,
  })
