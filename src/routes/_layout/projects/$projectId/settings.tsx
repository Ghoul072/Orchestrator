import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { projectQueryOptions } from '~/queries/projects'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/_layout/projects/$projectId/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const params = Route.useParams() as { projectId: string }
  const projectId = params.projectId

  const { data: project } = useQuery(projectQueryOptions(projectId))

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        {project && (
          <p className="text-sm text-muted-foreground">{project.name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GitHub Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            GitHub issue sync is managed per repository. Configure which repos
            sync issues on the Repositories page.
          </p>
          <p>
            Make sure your GitHub token is available via the environment
            (`GITHUB_TOKEN` or `GH_TOKEN`).
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/projects/$projectId/repositories" params={{ projectId }}>
              Manage repositories
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
