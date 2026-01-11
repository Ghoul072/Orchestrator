import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  GitBranchIcon,
  PlusIcon,
  GithubLogoIcon,
  CheckCircleIcon,
  ClockIcon,
  WarningCircleIcon,
  SpinnerIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface Repository {
  id: string
  name: string
  url: string
  branch: string | null
  cloneStatus: 'pending' | 'cloning' | 'cloned' | 'failed'
  stack?: string[] | null
  lastClonedAt?: Date | string | null
}

interface RepositoryListProps {
  repositories: Repository[]
  onRepositoryClick?: (id: string) => void
  onAddRepository?: () => void
  onDeleteRepository?: (id: string) => void
  className?: string
}

const statusConfig = {
  pending: {
    icon: ClockIcon,
    label: 'Pending',
    className: 'bg-yellow-500/10 text-yellow-600',
  },
  cloning: {
    icon: SpinnerIcon,
    label: 'Cloning',
    className: 'bg-blue-500/10 text-blue-600',
  },
  cloned: {
    icon: CheckCircleIcon,
    label: 'Cloned',
    className: 'bg-green-500/10 text-green-600',
  },
  failed: {
    icon: WarningCircleIcon,
    label: 'Failed',
    className: 'bg-red-500/10 text-red-600',
  },
}

export function RepositoryList({
  repositories,
  onRepositoryClick,
  onAddRepository,
  onDeleteRepository,
  className,
}: RepositoryListProps) {
  if (repositories.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GithubLogoIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">No repositories linked</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Link repositories to provide context for AI agents.
          </p>
          <Button onClick={onAddRepository}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Repository
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {repositories.map((repo) => (
        <RepositoryCard
          key={repo.id}
          repository={repo}
          onClick={() => onRepositoryClick?.(repo.id)}
          onDelete={() => onDeleteRepository?.(repo.id)}
        />
      ))}
    </div>
  )
}

function RepositoryCard({
  repository,
  onClick,
  onDelete,
}: {
  repository: Repository
  onClick?: () => void
  onDelete?: () => void
}) {
  const status = statusConfig[repository.cloneStatus]
  const StatusIcon = status.icon

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 cursor-pointer" onClick={onClick}>
            <div className="flex items-center gap-2">
              <GithubLogoIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{repository.name}</CardTitle>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {repository.url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
              </a>
              {repository.branch && (
                <span className="flex items-center gap-1">
                  <GitBranchIcon className="h-4 w-4" />
                  {repository.branch}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('gap-1', status.className)}>
              <StatusIcon
                className={cn('h-3 w-3', repository.cloneStatus === 'cloning' && 'animate-spin')}
              />
              {status.label}
            </Badge>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {repository.stack && repository.stack.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1">
            {repository.stack.map((tech) => (
              <Badge key={tech} variant="secondary" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
