import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, FileTextIcon, ChartLineUpIcon, ImageIcon } from '@phosphor-icons/react'
import { documentsQueryOptions } from '~/queries/documents'
import { projectQueryOptions } from '~/queries/projects'
import { createDocument } from '~/server/functions/documents'
import { DocumentList } from '~/components/documents/document-list'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

type DocumentType = 'note' | 'diagram' | 'upload'

export const Route = createFileRoute(
  '/_layout/projects/$projectId/documents'
)({
  component: DocumentsPage,
})

function DocumentsPage() {
  const params = Route.useParams() as { projectId: string }
  const projectId = params.projectId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState<DocumentType>('note')
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all')

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: documents, isLoading } = useQuery(
    documentsQueryOptions(projectId, filterType === 'all' ? undefined : filterType)
  )

  const createMutation = useMutation({
    mutationFn: (data: { title: string; type: DocumentType }) =>
      createDocument({
        data: {
          projectId,
          title: data.title,
          type: data.type,
        },
      }),
    onSuccess: (document: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setCreateDialogOpen(false)
      setNewDocTitle('')
      setNewDocType('note')
      // Navigate to the new document
      void navigate({
        to: '/projects/$projectId/documents/$docId' as const,
        params: { projectId, docId: document.id },
      })
    },
  })

  const handleCreateDocument = () => {
    if (!newDocTitle.trim()) return
    createMutation.mutate({
      title: newDocTitle.trim(),
      type: newDocType,
    })
  }

  const handleDocumentClick = (docId: string) => {
    void navigate({
      to: '/projects/$projectId/documents/$docId' as const,
      params: { projectId, docId },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          {project && (
            <p className="text-sm text-muted-foreground">{project.name}</p>
          )}
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Document
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={filterType}
        onValueChange={(v) => setFilterType(v as DocumentType | 'all')}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="note" className="gap-2">
            <FileTextIcon className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="diagram" className="gap-2">
            <ChartLineUpIcon className="h-4 w-4" />
            Diagrams
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Uploads
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DocumentList
        documents={(documents || []).map((d: {
          id: string
          title: string
          type: 'note' | 'diagram' | 'upload'
          content?: string | null
          updatedAt: Date | string
          linkedTaskId?: string | null
          linkedMeetingId?: string | null
        }) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          content: d.content,
          updatedAt: d.updatedAt,
          linkedTaskId: d.linkedTaskId,
          linkedMeetingId: d.linkedMeetingId,
        }))}
        onDocumentClick={handleDocumentClick}
        onCreateDocument={() => setCreateDialogOpen(true)}
      />

      {/* Create Document Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
            <DialogDescription>
              Create a new note, diagram, or upload a file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Document title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateDocument()
                }
              }}
            />
            <Select
              value={newDocType}
              onValueChange={(v) => setNewDocType(v as DocumentType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    Note
                  </div>
                </SelectItem>
                <SelectItem value="diagram">
                  <div className="flex items-center gap-2">
                    <ChartLineUpIcon className="h-4 w-4" />
                    Diagram (Mermaid)
                  </div>
                </SelectItem>
                <SelectItem value="upload">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Upload
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDocument}
              disabled={!newDocTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
