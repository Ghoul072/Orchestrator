import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GithubLogo, ArrowsClockwise, Check, X, LinkBreak } from '@phosphor-icons/react'
import { projectQueryOptions } from '~/queries/projects'
import {
  updateGitHubSettings,
  getGitHubStatus,
  syncFromGitHub,
  disconnectGitHub,
} from '~/server/functions/github'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'

export const Route = createFileRoute(
  '/_layout/projects/$projectId/settings'
)({
  component: SettingsPage,
})

function SettingsPage() {
  const params = Route.useParams() as { projectId: string }
  const projectId = params.projectId
  const queryClient = useQueryClient()

  const { data: project } = useQuery(projectQueryOptions(projectId))

  const { data: githubStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['github-status', projectId],
    queryFn: () => getGitHubStatus({ data: { projectId } }),
  })

  const [githubRepo, setGithubRepo] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(true)

  const connectMutation = useMutation({
    mutationFn: () =>
      updateGitHubSettings({
        data: {
          projectId,
          githubRepo,
          githubToken,
          githubSyncEnabled: syncEnabled,
        },
      }),
    onSuccess: () => {
      toast.success('GitHub connected successfully')
      setGithubRepo('')
      setGithubToken('')
      void refetchStatus()
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error) => {
      toast.error('Failed to connect GitHub', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncFromGitHub({ data: { projectId } }),
    onSuccess: (results) => {
      toast.success('Sync completed', {
        description: `Created: ${results.created}, Updated: ${results.updated}, Unchanged: ${results.unchanged}`,
      })
      void refetchStatus()
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: (error) => {
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGitHub({ data: { projectId } }),
    onSuccess: () => {
      toast.success('GitHub disconnected')
      void refetchStatus()
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error) => {
      toast.error('Failed to disconnect', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        {project && (
          <p className="text-sm text-muted-foreground">{project.name}</p>
        )}
      </div>

      {/* GitHub Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GithubLogo className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>
            Connect your project to a GitHub repository to sync tasks as issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {githubStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Connected to GitHub</p>
                    <a
                      href={githubStatus.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {githubStatus.repo}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    <ArrowsClockwise
                      className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                    />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <LinkBreak className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the GitHub connection. Existing tasks
                          linked to issues will keep their links but won't sync
                          anymore.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnectMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {githubStatus.lastSyncAt && (
                <p className="text-sm text-muted-foreground">
                  Last synced:{' '}
                  {new Date(githubStatus.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {githubStatus?.error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <X className="h-4 w-4" />
                  {githubStatus.error}: {githubStatus.repo}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="repo">Repository</Label>
                <Input
                  id="repo"
                  placeholder="owner/repository"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Format: owner/repository (e.g., anthropics/claude-code)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Generate a token with <code>repo</code> scope at{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    GitHub Settings
                  </a>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sync"
                  checked={syncEnabled}
                  onCheckedChange={setSyncEnabled}
                />
                <Label htmlFor="sync">Enable automatic sync suggestions</Label>
              </div>

              <Button
                onClick={() => connectMutation.mutate()}
                disabled={
                  !githubRepo || !githubToken || connectMutation.isPending
                }
              >
                {connectMutation.isPending ? 'Connecting...' : 'Connect GitHub'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
