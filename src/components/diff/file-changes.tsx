import { useState } from 'react'
import { DiffViewer } from './diff-viewer'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  CaretRightIcon,
  CaretDownIcon,
  FilePlusIcon,
  FileMinusIcon,
  FileArrowUpIcon,
  CopyIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  diff: string
  oldPath?: string // For renamed files
  language?: string
}

interface FileChangesProps {
  files: FileChange[]
  defaultExpanded?: boolean
  className?: string
}

const statusConfig = {
  added: {
    icon: FilePlusIcon,
    label: 'Added',
    className: 'bg-green-500/10 text-green-600',
    iconClassName: 'text-green-600',
  },
  modified: {
    icon: FileArrowUpIcon,
    label: 'Modified',
    className: 'bg-blue-500/10 text-blue-600',
    iconClassName: 'text-blue-600',
  },
  deleted: {
    icon: FileMinusIcon,
    label: 'Deleted',
    className: 'bg-red-500/10 text-red-600',
    iconClassName: 'text-red-600',
  },
  renamed: {
    icon: CopyIcon,
    label: 'Renamed',
    className: 'bg-yellow-500/10 text-yellow-600',
    iconClassName: 'text-yellow-600',
  },
}

export function FileChanges({
  files,
  defaultExpanded = false,
  className,
}: FileChangesProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    defaultExpanded ? new Set(files.map((f) => f.path)) : new Set()
  )

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedFiles(new Set(files.map((f) => f.path)))
  }

  const collapseAll = () => {
    setExpandedFiles(new Set())
  }

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {files.length} file{files.length !== 1 ? 's' : ''} changed
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">+{totalAdditions}</span>
            <span className="text-red-600">-{totalDeletions}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="space-y-2">
        {files.map((file) => (
          <FileChangeItem
            key={file.path}
            file={file}
            isExpanded={expandedFiles.has(file.path)}
            onToggle={() => toggleFile(file.path)}
          />
        ))}
      </div>
    </div>
  )
}

function FileChangeItem({
  file,
  isExpanded,
  onToggle,
}: {
  file: FileChange
  isExpanded: boolean
  onToggle: () => void
}) {
  const status = statusConfig[file.status]
  const StatusIcon = status.icon

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border">
        {/* File header */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-auto w-full items-center justify-between px-3 py-2 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <CaretDownIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <StatusIcon className={cn('h-4 w-4', status.iconClassName)} />
              <span className="font-mono text-sm">
                {file.status === 'renamed' && file.oldPath
                  ? `${file.oldPath} → ${file.path}`
                  : file.path}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {file.additions > 0 && (
                <span className="text-sm text-green-600">+{file.additions}</span>
              )}
              {file.deletions > 0 && (
                <span className="text-sm text-red-600">-{file.deletions}</span>
              )}
              <Badge variant="secondary" className={cn('text-xs', status.className)}>
                {status.label}
              </Badge>
            </div>
          </Button>
        </CollapsibleTrigger>

        {/* Diff content */}
        <CollapsibleContent>
          <div className="border-t">
            <DiffViewer
              diff={file.diff}
              language={file.language}
              className="rounded-none border-0"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/**
 * Detect language from file extension
 */
export function detectLanguage(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    mdx: 'markdown',
  }
  return ext ? languageMap[ext] : undefined
}

/**
 * Parse git diff output into file changes
 */
export function parseGitDiff(diffOutput: string): FileChange[] {
  const files: FileChange[] = []
  const fileDiffs = diffOutput.split(/^diff --git/m).slice(1)

  for (const fileDiff of fileDiffs) {
    const lines = fileDiff.split('\n')
    const headerLine = lines[0]

    // Extract file paths
    const pathMatch = headerLine.match(/a\/(.+?) b\/(.+)/)
    if (!pathMatch) continue

    const oldPath = pathMatch[1]
    const newPath = pathMatch[2]

    // Determine status
    let status: FileChange['status'] = 'modified'
    if (lines.some((l) => l.startsWith('new file mode'))) {
      status = 'added'
    } else if (lines.some((l) => l.startsWith('deleted file mode'))) {
      status = 'deleted'
    } else if (oldPath !== newPath) {
      status = 'renamed'
    }

    // Count additions and deletions
    let additions = 0
    let deletions = 0
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++
      }
    }

    files.push({
      path: newPath,
      oldPath: oldPath !== newPath ? oldPath : undefined,
      status,
      additions,
      deletions,
      diff: 'diff --git' + fileDiff,
      language: detectLanguage(newPath),
    })
  }

  return files
}
