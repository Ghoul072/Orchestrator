import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/projects/')({
  beforeLoad: () => {
    // Redirect /projects to dashboard which shows projects list
    throw redirect({ to: '/' })
  },
})
