import { useState, useEffect } from 'react'
import { TiptapEditor } from '~/components/editor/tiptap-editor'
import { MermaidBlock, mermaidTemplates } from '~/components/documents/mermaid-block'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  FloppyDiskIcon,
  TrashIcon,
  FileTextIcon,
  ChartLineUpIcon,
  ImageIcon,
  LinkIcon,
  PlusIcon,
  FlowArrowIcon,
  TreeStructureIcon,
  UsersThreeIcon,
  ChartBarIcon,
  CalendarIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

type DocumentType = 'note' | 'diagram' | 'upload'

interface DocumentEditorProps {
  initialData?: {
    title: string
    content: string
    type: DocumentType
    linkedTaskId?: string | null
    linkedMeetingId?: string | null
  }
  onSave: (data: {
    title: string
    content: string
    type: DocumentType
  }) => void
  onDelete?: () => void
  onLinkTask?: () => void
  onLinkMeeting?: () => void
  linkedTaskTitle?: string
  linkedMeetingTitle?: string
  isLoading?: boolean
  className?: string
}

const diagramTemplates = [
  { key: 'flowchart', label: 'Flowchart', icon: FlowArrowIcon },
  { key: 'sequence', label: 'Sequence', icon: UsersThreeIcon },
  { key: 'classDiagram', label: 'Class Diagram', icon: TreeStructureIcon },
  { key: 'erDiagram', label: 'ER Diagram', icon: ChartBarIcon },
  { key: 'gantt', label: 'Gantt Chart', icon: CalendarIcon },
] as const

export function DocumentEditor({
  initialData,
  onSave,
  onDelete,
  onLinkTask,
  onLinkMeeting,
  linkedTaskTitle,
  linkedMeetingTitle,
  isLoading = false,
  className,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [type, setType] = useState<DocumentType>(initialData?.type ?? 'note')

  // Reset form when initial data changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setContent(initialData.content)
      setType(initialData.type)
    }
  }, [initialData])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      content,
      type,
    })
  }

  const handleTypeChange = (newType: DocumentType) => {
    setType(newType)
    // If switching to diagram and content is empty, add template
    if (newType === 'diagram' && !content.trim()) {
      setContent(mermaidTemplates.flowchart)
    }
  }

  const insertDiagramTemplate = (templateKey: keyof typeof mermaidTemplates) => {
    const template = mermaidTemplates[templateKey]
    if (type === 'diagram') {
      setContent(template)
    } else {
      // For notes, wrap in mermaid code block
      setContent((prev) => `${prev}\n\n\`\`\`mermaid\n${template}\n\`\`\`\n`)
    }
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="border-0 bg-transparent text-xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Select value={type} onValueChange={(v) => handleTypeChange(v as DocumentType)}>
            <SelectTrigger className="w-auto">
              <SelectValue />
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
                  Diagram
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

        <div className="flex items-center gap-2">
          {type === 'diagram' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Template
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Diagram Templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {diagramTemplates.map((template) => {
                  const TemplateIcon = template.icon
                  return (
                    <DropdownMenuItem
                      key={template.key}
                      onClick={() => insertDiagramTemplate(template.key)}
                    >
                      <TemplateIcon className="mr-2 h-4 w-4" />
                      {template.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isLoading || !title.trim()}
          >
            <FloppyDiskIcon className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Linked items */}
      {(linkedTaskTitle || linkedMeetingTitle || onLinkTask || onLinkMeeting) && (
        <div className="flex items-center gap-4 border-b px-4 py-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap items-center gap-2">
            {linkedTaskTitle && (
              <Badge variant="secondary" className="gap-1">
                <FileTextIcon className="h-3 w-3" />
                {linkedTaskTitle}
              </Badge>
            )}
            {linkedMeetingTitle && (
              <Badge variant="secondary" className="gap-1">
                <CalendarIcon className="h-3 w-3" />
                {linkedMeetingTitle}
              </Badge>
            )}
            {onLinkTask && !linkedTaskTitle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLinkTask}
                className="h-7 text-xs"
              >
                <PlusIcon className="mr-1 h-3 w-3" />
                Link Task
              </Button>
            )}
            {onLinkMeeting && !linkedMeetingTitle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLinkMeeting}
                className="h-7 text-xs"
              >
                <PlusIcon className="mr-1 h-3 w-3" />
                Link Meeting
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content editor */}
      <div className="flex-1 overflow-auto p-4">
        {type === 'diagram' ? (
          <MermaidBlock
            code={content}
            onChange={setContent}
            editable={true}
            className="min-h-full"
          />
        ) : type === 'note' ? (
          <TiptapEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing..."
            minHeight="400px"
            className="min-h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-4 h-16 w-16" />
              <p>File upload coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
