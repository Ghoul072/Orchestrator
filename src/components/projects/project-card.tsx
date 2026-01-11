import { Link } from '@tanstack/react-router'
import { MoreHorizontal, FolderKanban, Archive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { Project } from '~/server/db/schema'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
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
