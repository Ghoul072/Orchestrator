import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import { TiptapEditor } from '~/components/editor/tiptap-editor'
import { Plus, Sparkles } from 'lucide-react'
import { createProject, generateTasksFromDescription } from '~/server/functions/projects'
import { toast } from 'sonner'

interface CreateProjectDialogProps {
  trigger?: React.ReactNode
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [generateTasks, setGenerateTasks] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const generateTasksMutation = useMutation({
    mutationFn: (projectId: string) =>
      generateTasksFromDescription({ data: { projectId } }),
    onSuccess: (result) => {
      toast.success(
        `Created ${result.tasksCreated} task${result.tasksCreated === 1 ? '' : 's'} from project description`
      )
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate tasks'
      )
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    try {
      const project = await createProject({
        data: { name: name.trim(), description: description.trim() || undefined },
      })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })

      // Generate tasks if description is provided and checkbox is checked
      if (generateTasks && description.trim().length >= 10) {
        toast.info('Generating initial tasks from project description...')
        await generateTasksMutation.mutateAsync(project.id)
      }

      setOpen(false)
      setName('')
      setDescription('')
      setGenerateTasks(true)

      // Navigate to the new project
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      })
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  const hasDescriptionForTasks = description.replace(/<[^>]*>/g, '').trim().length >= 10

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your tasks and repositories.
              Provide a detailed description to let AI generate initial tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <p className="text-xs text-muted-foreground">
                Describe your project in detail. The more context you provide,
                the better tasks AI can generate.
              </p>
              <TiptapEditor
                content={description}
                onChange={setDescription}
                placeholder="Describe your project... What are you building? What features should it have? What technologies will you use?"
                minHeight="200px"
              />
            </div>
            <label
              htmlFor="generate-tasks"
              className="flex items-center gap-3 rounded-lg border p-4 bg-muted/30 cursor-pointer"
            >
              <Checkbox
                id="generate-tasks"
                checked={generateTasks && hasDescriptionForTasks}
                onCheckedChange={(checked) => setGenerateTasks(checked === true)}
                disabled={!hasDescriptionForTasks}
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Generate initial tasks from description</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasDescriptionForTasks
                    ? 'AI will analyze your description and create a task breakdown'
                    : 'Add more details to your description (at least 10 characters) to enable AI task generation'}
                </p>
              </div>
            </label>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                generateTasks && hasDescriptionForTasks ? (
                  'Creating & Generating Tasks...'
                ) : (
                  'Creating...'
                )
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
