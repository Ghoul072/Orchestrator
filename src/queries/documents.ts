import { queryOptions } from '@tanstack/react-query'
import { listDocuments, getDocument, getDocumentsByTask, getDocumentsByMeeting } from '~/server/functions/documents'

export const documentsQueryOptions = (
  projectId: string,
  type?: 'note' | 'diagram' | 'upload'
) =>
  queryOptions({
    queryKey: ['documents', projectId, type],
    queryFn: () => listDocuments({ data: { projectId, type } }),
    enabled: !!projectId,
  })

export const documentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['document', id],
    queryFn: () => getDocument({ data: { id } }),
    enabled: !!id,
  })

export const documentsByTaskQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ['documents', 'task', taskId],
    queryFn: () => getDocumentsByTask({ data: { taskId } }),
    enabled: !!taskId,
  })

export const documentsByMeetingQueryOptions = (meetingId: string) =>
  queryOptions({
    queryKey: ['documents', 'meeting', meetingId],
    queryFn: () => getDocumentsByMeeting({ data: { meetingId } }),
    enabled: !!meetingId,
  })
