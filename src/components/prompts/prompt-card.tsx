import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { MoreVerticalIcon, EditIcon, CopyIcon, TrashIcon } from 'lucide-react'
import { deletePrompt, duplicatePrompt } from '~/server/functions/prompts'
import type { Prompt } from '~/server/db/schema'

interface PromptCardProps {
  prompt: Prompt
  onEdit: (prompt: Prompt) => void
  onSelect?: (prompt: Prompt) => void
}

export function PromptCard({ prompt, onEdit, onSelect }: PromptCardProps) {
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deletePrompt({ data: { id: prompt.id } }),
    onSuccess: () => {
      toast.success('Prompt deleted')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
    onError: (error) => {
      toast.error('Failed to delete prompt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: () => duplicatePrompt({ data: { id: prompt.id } }),
    onSuccess: () => {
      toast.success('Prompt duplicated')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
    onError: (error) => {
      toast.error('Failed to duplicate prompt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const handleClick = () => {
    if (onSelect) {
      onSelect(prompt)
    }
  }

  return (
    <>
      <Card
        className={`transition-all ${onSelect ? 'cursor-pointer hover:border-primary' : ''}`}
        onClick={handleClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{prompt.name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}>
                  <EditIcon className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicateMutation.mutate()
                  }}
                >
                  <CopyIcon className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteDialogOpen(true)
                  }}
                  className="text-destructive"
                  disabled={prompt.isBuiltIn}
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          {prompt.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {prompt.description}
            </p>
          )}
          <pre className="mt-2 max-h-24 overflow-hidden text-xs text-muted-foreground bg-muted p-2 rounded line-clamp-3">
            {prompt.content.slice(0, 200)}
            {prompt.content.length > 200 && '...'}
          </pre>
        </CardContent>

        <CardFooter className="pt-2">
          <div className="flex flex-wrap gap-1">
            {prompt.category && (
              <Badge variant="outline" className="text-xs">
                {prompt.category}
              </Badge>
            )}
            {prompt.variables && prompt.variables.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {prompt.variables.length} variable{prompt.variables.length > 1 ? 's' : ''}
              </Badge>
            )}
            {prompt.isBuiltIn && (
              <Badge variant="default" className="text-xs">
                Built-in
              </Badge>
            )}
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{prompt.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
