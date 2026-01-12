import { useState, useMemo } from 'react'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  ColumnsIcon,
  ListIcon,
  PlusIcon,
  MinusIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'
import { useHighlighter, getLanguageFromPath, type HighlightedLine } from '~/lib/use-highlighter'
import type { BundledLanguage } from 'shiki'
import {
  CommentIndicator,
  type DiffLineComment,
} from './diff-line-comments'

interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'header'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
  highlighted?: HighlightedLine
}

interface DiffViewerProps {
  diff: string
  fileName?: string
  language?: string
  viewMode?: 'unified' | 'split'
  onViewModeChange?: (mode: 'unified' | 'split') => void
  comments?: DiffLineComment[]
  onAddComment?: (comment: Omit<DiffLineComment, 'id' | 'createdAt'>) => void
  onRemoveComment?: (commentId: string) => void
  enableComments?: boolean
  className?: string
}

export function DiffViewer({
  diff,
  fileName,
  language,
  viewMode = 'unified',
  onViewModeChange,
  comments = [],
  onAddComment,
  onRemoveComment,
  enableComments = false,
  className,
}: DiffViewerProps) {
  const [mode, setMode] = useState<'unified' | 'split'>(viewMode)
  const { highlightLine, isLoading: highlighterLoading } = useHighlighter()

  // Detect language from filename if not provided
  const detectedLanguage = useMemo(() => {
    if (language) return language as BundledLanguage
    if (fileName) return getLanguageFromPath(fileName)
    return null
  }, [language, fileName])

  // Parse and highlight diff lines
  const lines = useMemo(() => {
    const parsed = parseDiff(diff)

    // Skip highlighting if highlighter is loading
    if (highlighterLoading || !detectedLanguage) {
      return parsed
    }

    // Add syntax highlighting to each line
    return parsed.map((line) => {
      if (line.type === 'header') {
        return line
      }
      return {
        ...line,
        highlighted: highlightLine(line.content, detectedLanguage, 'github-dark'),
      }
    })
  }, [diff, highlighterLoading, detectedLanguage, highlightLine])

  const handleModeChange = (newMode: 'unified' | 'split') => {
    setMode(newMode)
    onViewModeChange?.(newMode)
  }

  return (
    <div className={cn('rounded-lg border bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="font-mono text-sm font-medium">{fileName}</span>
          )}
          {language && (
            <Badge variant="secondary" className="text-xs">
              {language}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === 'unified' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('unified')}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={mode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('split')}
          >
            <ColumnsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Diff content */}
      <ScrollArea className="max-h-[600px]">
        {mode === 'unified' ? (
          <UnifiedView
            lines={lines}
            comments={comments}
            onAddComment={onAddComment}
            onRemoveComment={onRemoveComment}
            enableComments={enableComments}
          />
        ) : (
          <SplitView
            lines={lines}
            comments={comments}
            onAddComment={onAddComment}
            onRemoveComment={onRemoveComment}
            enableComments={enableComments}
          />
        )}
      </ScrollArea>
    </div>
  )
}

function UnifiedView({
  lines,
  comments,
  onAddComment,
  onRemoveComment,
  enableComments,
}: {
  lines: DiffLine[]
  comments: DiffLineComment[]
  onAddComment?: (comment: Omit<DiffLineComment, 'id' | 'createdAt'>) => void
  onRemoveComment?: (commentId: string) => void
  enableComments: boolean
}) {
  return (
    <div className="font-mono text-sm">
      {lines.map((line, index) => {
        const lineNumber = line.newLineNumber ?? line.oldLineNumber ?? 0
        const canComment =
          enableComments && onAddComment && line.type !== 'header' && lineNumber > 0
        return (
          <div
            key={index}
            className={cn(
              'group flex',
              line.type === 'add' && 'bg-green-500/10',
              line.type === 'remove' && 'bg-red-500/10',
              line.type === 'header' && 'bg-muted/50 text-muted-foreground'
            )}
          >
            {/* Comment indicator */}
            <div className="flex w-6 flex-shrink-0 items-center justify-center">
              {canComment && onRemoveComment && (
                <CommentIndicator
                  lineNumber={lineNumber}
                  lineType={line.type as 'add' | 'remove' | 'context'}
                  comments={comments}
                  onAddComment={onAddComment}
                  onRemoveComment={onRemoveComment}
                />
              )}
            </div>

            {/* Line numbers */}
            <div className="flex w-20 flex-shrink-0 select-none border-r text-muted-foreground">
              <span className="w-10 px-2 text-right">
                {line.oldLineNumber ?? ''}
              </span>
              <span className="w-10 px-2 text-right">
                {line.newLineNumber ?? ''}
              </span>
            </div>

            {/* Change indicator */}
            <div className="w-6 flex-shrink-0 px-1 text-center">
              {line.type === 'add' && (
                <PlusIcon className="inline h-4 w-4 text-green-600" />
              )}
              {line.type === 'remove' && (
                <MinusIcon className="inline h-4 w-4 text-red-600" />
              )}
            </div>

            {/* Content with syntax highlighting */}
            <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
              <HighlightedContent line={line} />
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function HighlightedContent({ line }: { line: DiffLine }) {
  if (!line.highlighted || line.highlighted.tokens.length === 0) {
    return <>{line.content}</>
  }

  return (
    <>
      {line.highlighted.tokens.map((token, i) => (
        <span
          key={i}
          style={{
            color: token.color,
            fontStyle: token.fontStyle,
          }}
        >
          {token.content}
        </span>
      ))}
    </>
  )
}

function SplitView({
  lines,
  comments,
  onAddComment,
  onRemoveComment,
  enableComments,
}: {
  lines: DiffLine[]
  comments: DiffLineComment[]
  onAddComment?: (comment: Omit<DiffLineComment, 'id' | 'createdAt'>) => void
  onRemoveComment?: (commentId: string) => void
  enableComments: boolean
}) {
  const { left, right } = splitLines(lines)

  return (
    <div className="flex font-mono text-sm">
      {/* Left side (old) */}
      <div className="w-1/2 border-r">
        {left.map((line, index) => {
          const lineNumber = line?.oldLineNumber ?? 0
          const canComment =
            enableComments &&
            onAddComment &&
            line?.type === 'remove' &&
            lineNumber > 0
          return (
            <div
              key={index}
              className={cn(
                'group flex',
                line?.type === 'remove' && 'bg-red-500/10',
                line?.type === 'header' && 'bg-muted/50 text-muted-foreground'
              )}
            >
              {/* Comment indicator */}
              <div className="flex w-6 flex-shrink-0 items-center justify-center">
                {canComment && onRemoveComment && (
                  <CommentIndicator
                    lineNumber={lineNumber}
                    lineType="remove"
                    comments={comments}
                    onAddComment={onAddComment}
                    onRemoveComment={onRemoveComment}
                  />
                )}
              </div>
              <span className="w-10 flex-shrink-0 select-none border-r px-2 text-right text-muted-foreground">
                {line?.oldLineNumber ?? ''}
              </span>
              <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
                {line ? <HighlightedContent line={line} /> : ''}
              </pre>
            </div>
          )
        })}
      </div>

      {/* Right side (new) */}
      <div className="w-1/2">
        {right.map((line, index) => {
          const lineNumber = line?.newLineNumber ?? 0
          const canComment =
            enableComments &&
            onAddComment &&
            line?.type === 'add' &&
            lineNumber > 0
          return (
            <div
              key={index}
              className={cn(
                'group flex',
                line?.type === 'add' && 'bg-green-500/10',
                line?.type === 'header' && 'bg-muted/50 text-muted-foreground'
              )}
            >
              {/* Comment indicator */}
              <div className="flex w-6 flex-shrink-0 items-center justify-center">
                {canComment && onRemoveComment && (
                  <CommentIndicator
                    lineNumber={lineNumber}
                    lineType="add"
                    comments={comments}
                    onAddComment={onAddComment}
                    onRemoveComment={onRemoveComment}
                  />
                )}
              </div>
              <span className="w-10 flex-shrink-0 select-none border-r px-2 text-right text-muted-foreground">
                {line?.newLineNumber ?? ''}
              </span>
              <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
                {line ? <HighlightedContent line={line} /> : ''}
              </pre>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Parse unified diff format into structured lines
 */
function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n')
  const result: DiffLine[] = []

  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -start,count +start,count @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({ type: 'header', content: line })
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({
        type: 'add',
        content: line.slice(1),
        newLineNumber: newLine++,
      })
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({
        type: 'remove',
        content: line.slice(1),
        oldLineNumber: oldLine++,
      })
    } else if (line.startsWith(' ')) {
      result.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      })
    } else if (line.startsWith('diff ') || line.startsWith('index ') ||
               line.startsWith('---') || line.startsWith('+++')) {
      result.push({ type: 'header', content: line })
    }
  }

  return result
}

/**
 * Split lines into left (old) and right (new) for split view
 */
function splitLines(lines: DiffLine[]): {
  left: (DiffLine | null)[]
  right: (DiffLine | null)[]
} {
  const left: (DiffLine | null)[] = []
  const right: (DiffLine | null)[] = []

  for (const line of lines) {
    if (line.type === 'header') {
      left.push(line)
      right.push(line)
    } else if (line.type === 'context') {
      left.push(line)
      right.push(line)
    } else if (line.type === 'add') {
      left.push(null)
      right.push(line)
    } else if (line.type === 'remove') {
      left.push(line)
      right.push(null)
    }
  }

  return { left, right }
}
