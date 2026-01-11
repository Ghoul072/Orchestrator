import { useState, useEffect } from 'react'
import { TiptapEditor } from '~/components/editor/tiptap-editor'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  CalendarIcon,
  UsersIcon,
  FloppyDiskIcon,
  TrashIcon,
  XIcon,
  PlusIcon,
  CheckCircleIcon,
  LightningIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface MeetingEditorProps {
  initialData?: {
    title: string
    date: string
    attendees: string[]
    content: string
    status: 'draft' | 'finalized'
    summary?: string
  }
  onSave: (data: {
    title: string
    date: string
    attendees: string[]
    content: string
    status: 'draft' | 'finalized'
    summary?: string
  }) => void
  onDelete?: () => void
  onGenerateTasks?: () => void
  isLoading?: boolean
  className?: string
}

export function MeetingEditor({
  initialData,
  onSave,
  onDelete,
  onGenerateTasks,
  isLoading = false,
  className,
}: MeetingEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [date, setDate] = useState(
    initialData?.date ?? new Date().toISOString().split('T')[0]
  )
  const [attendees, setAttendees] = useState<string[]>(
    initialData?.attendees ?? []
  )
  const [content, setContent] = useState(initialData?.content ?? '')
  const [status, setStatus] = useState<'draft' | 'finalized'>(
    initialData?.status ?? 'draft'
  )
  const [newAttendee, setNewAttendee] = useState('')

  // Reset form when initial data changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setDate(initialData.date)
      setAttendees(initialData.attendees)
      setContent(initialData.content)
      setStatus(initialData.status)
    }
  }, [initialData])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      date,
      attendees,
      content,
      status,
    })
  }

  const addAttendee = () => {
    if (!newAttendee.trim()) return
    if (attendees.includes(newAttendee.trim())) return
    setAttendees([...attendees, newAttendee.trim()])
    setNewAttendee('')
  }

  const removeAttendee = (attendee: string) => {
    setAttendees(attendees.filter((a) => a !== attendee))
  }

  const handleFinalize = () => {
    setStatus('finalized')
    onSave({
      title: title.trim(),
      date,
      attendees,
      content,
      status: 'finalized',
    })
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="border-0 bg-transparent text-xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Badge
            variant={status === 'finalized' ? 'default' : 'secondary'}
            className={cn(
              status === 'finalized' &&
                'bg-green-500/10 text-green-600 hover:bg-green-500/20'
            )}
          >
            {status === 'finalized' ? (
              <>
                <CheckCircleIcon className="mr-1 h-3 w-3" weight="fill" />
                Finalized
              </>
            ) : (
              'Draft'
            )}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
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
          {status === 'draft' && (
            <Button
              size="sm"
              onClick={handleFinalize}
              disabled={isLoading || !title.trim()}
            >
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Finalize
            </Button>
          )}
        </div>
      </div>

      {/* Meeting metadata */}
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          {/* Date */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
          </div>

          {/* Attendees */}
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap items-center gap-2">
              {attendees.map((attendee) => (
                <Badge
                  key={attendee}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {attendee}
                  <button
                    onClick={() => removeAttendee(attendee)}
                    className="ml-1 rounded-full hover:bg-muted"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  value={newAttendee}
                  onChange={(e) => setNewAttendee(e.target.value)}
                  placeholder="Add attendee"
                  className="h-7 w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addAttendee()
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={addAttendee}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content editor */}
      <div className="flex-1 overflow-auto p-4">
        <TiptapEditor
          content={content}
          onChange={setContent}
          placeholder="Start taking notes..."
          minHeight="400px"
          className="min-h-full"
        />
      </div>

      {/* Action buttons */}
      {status === 'finalized' && onGenerateTasks && (
        <div className="border-t px-4 py-3">
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Generate Tasks from Meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <p className="flex-1 text-sm text-muted-foreground">
                Let AI analyze this meeting and generate tasks based on action
                items and decisions.
              </p>
              <Button onClick={onGenerateTasks} disabled={isLoading}>
                <LightningIcon className="mr-2 h-4 w-4" weight="fill" />
                Generate Tasks
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
