import { createFileRoute } from '@tanstack/react-router'
import { ProjectsList } from '~/components/projects/projects-list'
import { CreateProjectDialog } from '~/components/projects/create-project-dialog'

export const Route = createFileRoute('/_layout/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your development projects with AI-powered assistance
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      <ProjectsList />
    </div>
  )
}
