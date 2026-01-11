import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { GithubLogoIcon } from '@phosphor-icons/react'

interface AddRepositoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { url: string; name: string; branch: string }) => void
  isLoading?: boolean
}

export function AddRepositoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: AddRepositoryDialogProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [branch, setBranch] = useState('main')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Auto-derive name from URL if not provided
    const derivedName = name.trim() || extractRepoName(url)
    onSubmit({
      url: url.trim(),
      name: derivedName,
      branch: branch.trim() || 'main',
    })
  }

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    // Auto-fill name from URL
    if (!name.trim()) {
      const derived = extractRepoName(newUrl)
      if (derived) {
        setName(derived)
      }
    }
  }

  const handleClose = () => {
    setUrl('')
    setName('')
    setBranch('main')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GithubLogoIcon className="h-5 w-5" />
              Add Repository
            </DialogTitle>
            <DialogDescription>
              Link a GitHub repository to provide context for AI agents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Repository URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repo"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the full GitHub URL or owner/repo format
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-derived from URL"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || isLoading}>
              {isLoading ? 'Adding...' : 'Add Repository'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Extract repository name from various GitHub URL formats
 */
function extractRepoName(url: string): string {
  // Handle various URL formats
  const patterns = [
    /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/,
    /^([^/]+)\/([^/]+)$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[2]
    }
  }

  return ''
}
