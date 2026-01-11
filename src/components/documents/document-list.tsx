import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  FileTextIcon,
  ChartLineUpIcon,
  ImageIcon,
  PlusIcon,
  ClockIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface Document {
  id: string
  title: string
  type: 'note' | 'diagram' | 'upload'
  content?: string | null
  updatedAt: Date | string
  linkedTaskId?: string | null
  linkedMeetingId?: string | null
}

interface DocumentListProps {
  documents: Document[]
  onDocumentClick?: (id: string) => void
  onCreateDocument?: () => void
  className?: string
}

const typeConfig = {
  note: {
    icon: FileTextIcon,
    label: 'Note',
    className: 'bg-blue-500/10 text-blue-600',
  },
  diagram: {
    icon: ChartLineUpIcon,
    label: 'Diagram',
    className: 'bg-purple-500/10 text-purple-600',
  },
  upload: {
    icon: ImageIcon,
    label: 'Upload',
    className: 'bg-green-500/10 text-green-600',
  },
}

export function DocumentList({
  documents,
  onDocumentClick,
  onCreateDocument,
  className,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileTextIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">No documents yet</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Create notes, diagrams, or upload files to document your project.
          </p>
          <Button onClick={onCreateDocument}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Document
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onClick={() => onDocumentClick?.(doc.id)}
        />
      ))}
    </div>
  )
}

function DocumentCard({
  document,
  onClick,
}: {
  document: Document
  onClick?: () => void
}) {
  const config = typeConfig[document.type]
  const TypeIcon = config.icon
  const updatedAt =
    typeof document.updatedAt === 'string'
      ? new Date(document.updatedAt)
      : document.updatedAt

  // Extract preview from content
  const preview = document.content
    ? document.content.replace(/<[^>]*>/g, '').slice(0, 100) + '...'
    : 'No content'

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="line-clamp-1 text-base">
              {document.title}
            </CardTitle>
          </div>
          <Badge className={cn('text-xs', config.className)}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-sm text-muted-foreground">{preview}</p>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="h-3 w-3" />
          {updatedAt.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </CardContent>
    </Card>
  )
}
