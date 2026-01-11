import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { completeAuth } from '~/server/auth'

export const Route = createFileRoute('/auth/callback')({
  component: CallbackPage,
})

function CallbackPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const state = params.get('state')
        const errorParam = params.get('error')

        if (errorParam) {
          throw new Error(params.get('error_description') || 'OAuth error')
        }

        if (!code || !state) {
          throw new Error('Missing code or state')
        }

        // Complete the auth flow
        const result = await completeAuth({ data: { code, state } })

        // Set the session cookie
        document.cookie = result.sessionCookie

        // Clear the OAuth state cookie
        document.cookie = result.clearStateCookie

        // Invalidate auth queries
        await queryClient.invalidateQueries({ queryKey: ['auth'] })

        setStatus('success')

        // Redirect after a short delay
        setTimeout(() => {
          navigate({ to: result.returnUrl || '/' })
        }, 1500)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    }

    handleCallback()
  }, [navigate, queryClient])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Completing Sign In</CardTitle>
            <CardDescription>
              Please wait while we verify your credentials...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Sign In Successful</CardTitle>
            <CardDescription>Redirecting you to the dashboard...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Sign In Failed</CardTitle>
          <CardDescription>
            {error || 'An error occurred during authentication'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => navigate({ to: '/auth/login' })}
            className="w-full"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
