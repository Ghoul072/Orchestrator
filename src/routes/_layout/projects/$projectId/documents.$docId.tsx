import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentQueryOptions } from '~/queries/documents'
import { projectQueryOptions } from '~/queries/projects'
import {
  updateDocument,
  deleteDocument,
  generateTasksFromDocument,
} from '~/server/functions/documents'
import { DocumentEditor } from '~/components/documents/document-editor'
import { Skeleton } from '~/components/ui/skeleton'
import { Button } from '~/components/ui/button'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface DocumentData {
  id: string
  title: string
  content: string | null
  type: 'note' | 'diagram' | 'upload'
  linkedTaskId: string | null
  linkedMeetingId: string | null
}

export const Route = createFileRoute(
  '/_layout/projects/$projectId/documents/$docId'
)({
  component: DocumentDetailPage,
})

function DocumentDetailPage() {
  const params = Route.useParams() as { projectId: string; docId: string }
  const projectId = params.projectId
  const docId = params.docId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: document, isLoading } = useQuery(documentQueryOptions(docId)) as {
    data: DocumentData | undefined
    isLoading: boolean
  }

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string
      content: string
      type: 'note' | 'diagram' | 'upload'
    }) =>
      updateDocument({
        data: {
          id: docId,
          title: data.title,
          content: data.content,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', docId] })
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument({ data: { id: docId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      void navigate({
        to: '/projects/$projectId/documents' as const,
        params: { projectId },
      })
    },
  })

  const generateTasksMutation = useMutation({
    mutationFn: () =>
      generateTasksFromDocument({
        data: {
          documentId: docId,
          projectId,
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['document', docId] })
      toast.success(`Generated ${result.tasksCreated} task${result.tasksCreated !== 1 ? 's' : ''} from document`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate tasks: ${error.message}`)
    },
  })

  const handleBack = () => {
    void navigate({
      to: '/projects/$projectId/documents' as const,
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

  if (!document) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h2 className="text-lg font-medium">Document not found</h2>
        <p className="mb-4 text-muted-foreground">
          The document you're looking for doesn't exist.
        </p>
        <Button onClick={handleBack}>Back to Documents</Button>
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
          {project?.name} / Documents
        </span>
      </div>

      {/* Editor */}
      <DocumentEditor
        initialData={{
          title: document.title,
          content: document.content ?? '',
          type: document.type,
          linkedTaskId: document.linkedTaskId,
          linkedMeetingId: document.linkedMeetingId,
        }}
        onSave={(data) => updateMutation.mutate(data)}
        onDelete={() => deleteMutation.mutate()}
        onGenerateTasks={() => generateTasksMutation.mutate()}
        onLinkTask={() => {
          // TODO: Implement task linking dialog
          console.log('Link task to document')
        }}
        onLinkMeeting={() => {
          // TODO: Implement meeting linking dialog
          console.log('Link meeting to document')
        }}
        isLoading={updateMutation.isPending || deleteMutation.isPending}
        isGenerating={generateTasksMutation.isPending}
        className="flex-1"
      />
    </div>
  )
}
