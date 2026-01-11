import { Link } from '@tanstack/react-router'
import { MoreHorizontal, FolderKanban, Archive, Pencil, Trash2, ArchiveRestore } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import type { Project } from '~/server/db/schema'

interface ProjectCardProps {
  project: Project
  onEdit?: (project: Project) => void
  onArchive?: (project: Project) => void
  onDelete?: (project: Project) => void
}

export function ProjectCard({ project, onEdit, onArchive, onDelete }: ProjectCardProps) {
  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{project.name}</CardTitle>
                {project.isArchived && (
                  <Badge variant="secondary" className="mt-1 gap-1">
                    <Archive className="h-3 w-3" />
                    Archived
                  </Badge>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(project)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onArchive && (
                  <DropdownMenuItem onClick={() => onArchive(project)}>
                    {project.isArchived ? (
                      <>
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Unarchive
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(project)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {project.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/50">
              No description
            </p>
          )}
        </CardContent>
      </Link>
    </Card>
  )
}
