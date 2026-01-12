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

  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    // Auto-fill name from URL (only if user hasn't manually edited the name)
    if (!nameManuallyEdited) {
      const derived = extractRepoName(newUrl)
      if (derived) {
        setName(derived)
      }
    }
  }

  const handleNameChange = (newName: string) => {
    setName(newName)
    setNameManuallyEdited(true)
  }

  const handleClose = () => {
    setUrl('')
    setName('')
    setBranch('main')
    setNameManuallyEdited(false)
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
                onChange={(e) => handleNameChange(e.target.value)}
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
 * Only returns a name when the URL appears complete (ends with a valid repo name)
 */
function extractRepoName(url: string): string {
  // Trim the URL
  const trimmed = url.trim()
  if (!trimmed) return ''

  // Handle full GitHub URLs: https://github.com/owner/repo or git@github.com:owner/repo
  const fullUrlPattern = /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/
  const fullMatch = trimmed.match(fullUrlPattern)
  if (fullMatch && fullMatch[2] && fullMatch[2].length >= 2) {
    return fullMatch[2]
  }

  // Handle owner/repo format (only when it looks complete - at least 2 chars in repo name)
  const shortPattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]{2,})$/
  const shortMatch = trimmed.match(shortPattern)
  if (shortMatch && shortMatch[2]) {
    return shortMatch[2]
  }

  return ''
}
