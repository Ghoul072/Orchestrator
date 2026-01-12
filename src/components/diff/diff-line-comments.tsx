import { useState, useCallback } from 'react'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  ChatCircleIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

export interface DiffLineComment {
  id: string
  lineNumber: number
  lineType: 'add' | 'remove' | 'context'
  content: string
  isChangeRequest: boolean
  createdAt: Date
}

export function useDiffLineComments() {
  const [comments, setComments] = useState<DiffLineComment[]>([])

  const addComment = useCallback(
    (comment: Omit<DiffLineComment, 'id' | 'createdAt'>) => {
      setComments((prev) => [
        ...prev,
        {
          ...comment,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        },
      ])
    },
    []
  )

  const removeComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }, [])

  const clearComments = useCallback(() => {
    setComments([])
  }, [])

  const hasChangeRequests = comments.some((c) => c.isChangeRequest)

  return {
    comments,
    addComment,
    removeComment,
    clearComments,
    hasChangeRequests,
  }
}

export function CommentIndicator({
  lineNumber,
  lineType,
  comments,
  onAddComment,
  onRemoveComment,
  readOnly = false,
}: {
  lineNumber: number
  lineType: 'add' | 'remove' | 'context'
  comments: DiffLineComment[]
  onAddComment: (comment: Omit<DiffLineComment, 'id' | 'createdAt'>) => void
  onRemoveComment: (commentId: string) => void
  readOnly?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isChangeRequest, setIsChangeRequest] = useState(false)

  const lineComments = comments.filter(
    (c) => c.lineNumber === lineNumber && c.lineType === lineType
  )

  const handleAddComment = () => {
    if (!newComment.trim()) return
    onAddComment({
      lineNumber,
      lineType,
      content: newComment.trim(),
      isChangeRequest,
    })
    setNewComment('')
    setIsChangeRequest(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded',
            'opacity-0 transition-opacity group-hover:opacity-100',
            lineComments.length > 0 && 'opacity-100',
            lineComments.some((c) => c.isChangeRequest)
              ? 'bg-orange-500/20 text-orange-600'
              : lineComments.length > 0
                ? 'bg-blue-500/20 text-blue-600'
                : 'hover:bg-muted text-muted-foreground'
          )}
        >
          {lineComments.length > 0 ? (
            <span className="text-xs font-medium">{lineComments.length}</span>
          ) : (
            <PlusIcon className="h-3 w-3" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          {/* Existing comments */}
          {lineComments.length > 0 && (
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {lineComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      'rounded-md border p-2',
                      comment.isChangeRequest
                        ? 'border-orange-500/30 bg-orange-500/10'
                        : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {comment.isChangeRequest && (
                          <Badge
                            variant="secondary"
                            className="mb-1 gap-1 bg-orange-500/20 text-orange-600 text-xs"
                          >
                            <WarningCircleIcon className="h-3 w-3" />
                            Change Requested
                          </Badge>
                        )}
                        <p className="text-sm">{comment.content}</p>
                      </div>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => onRemoveComment(comment.id)}
                        >
                          <TrashIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Add new comment */}
          {!readOnly && (
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isChangeRequest}
                    onChange={(e) => setIsChangeRequest(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  <span className="flex items-center gap-1 text-orange-600">
                    <WarningCircleIcon className="h-3 w-3" />
                    Request change
                  </span>
                </label>
                <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                  <ChatCircleIcon className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CommentsSummary({
  comments,
  onClear,
  className,
}: {
  comments: DiffLineComment[]
  onClear?: () => void
  className?: string
}) {
  if (comments.length === 0) return null

  const changeRequests = comments.filter((c) => c.isChangeRequest)
  const regularComments = comments.filter((c) => !c.isChangeRequest)

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {regularComments.length > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <ChatCircleIcon className="h-4 w-4 text-blue-500" />
            <span>
              {regularComments.length} comment{regularComments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {changeRequests.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-orange-600">
            <WarningCircleIcon className="h-4 w-4" weight="fill" />
            <span>
              {changeRequests.length} change request{changeRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      {onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon className="mr-1 h-4 w-4" />
          Clear all
        </Button>
      )}
    </div>
  )
}
