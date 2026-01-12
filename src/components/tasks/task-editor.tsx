import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'
import { TiptapEditor } from '~/components/editor/tiptap-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Plus,
  Trash,
  X,
  CheckCircle,
  Robot,
} from '@phosphor-icons/react'
import { Checkbox } from '~/components/ui/checkbox'
import { cn } from '~/lib/utils'

type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
type TaskEffort = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface TaskFormData {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  effort?: TaskEffort
  assignee?: string
  acceptanceCriteria: string[]
  dueDate?: string
  repositoryId?: string | null
  parentId?: string | null
  autoAssignAgent?: boolean
}

interface TaskEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Partial<TaskFormData>
  repositories?: Array<{ id: string; name: string }>
  onSubmit: (data: TaskFormData) => void
  onDelete?: () => void
  isEditing?: boolean
  isLoading?: boolean
  parentTaskTitle?: string
}

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-slate-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
]

const effortOptions: { value: TaskEffort; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
]

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function TaskEditor({
  open,
  onOpenChange,
  initialData,
  repositories = [],
  onSubmit,
  onDelete,
  isEditing = false,
  isLoading = false,
  parentTaskTitle,
}: TaskEditorProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    acceptanceCriteria: [],
    autoAssignAgent: true, // Default to auto-assign for new tasks
    ...initialData,
  })

  const [newCriterion, setNewCriterion] = useState('')

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      const nextData: TaskFormData = {
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium',
        acceptanceCriteria: [],
        autoAssignAgent: !isEditing, // Auto-assign by default for new tasks only
        ...initialData,
      }
      if (nextData.repositoryId === undefined && repositories.length === 1) {
        nextData.repositoryId = repositories[0]?.id ?? null
      }
      setFormData(nextData)
      setNewCriterion('')
    }
  }, [open, initialData, repositories, isEditing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return
    onSubmit(formData)
  }

  const addCriterion = () => {
    if (!newCriterion.trim()) return
    setFormData((prev) => ({
      ...prev,
      acceptanceCriteria: [...prev.acceptanceCriteria, newCriterion.trim()],
    }))
    setNewCriterion('')
  }

  const removeCriterion = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? 'Edit Task'
              : parentTaskTitle
                ? 'Create Subtask'
                : 'Create New Task'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the task details below.'
              : parentTaskTitle
                ? `Creating subtask under "${parentTaskTitle}"`
                : 'Fill in the details to create a new task.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Task title"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <TiptapEditor
                  content={formData.description || ''}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: html,
                    }))
                  }
                  placeholder="Describe the task..."
                  minHeight="150px"
                />
              </div>

              {/* Status & Priority row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          formData.status === option.value
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            status: option.value,
                          }))
                        }
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <div className="flex gap-2">
                    {priorityOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          formData.priority === option.value
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            priority: option.value,
                          }))
                        }
                        className="gap-1"
                      >
                        <div
                          className={cn('h-2 w-2 rounded-full', option.color)}
                        />
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Effort & Due Date row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Effort */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Effort</label>
                  <div className="flex gap-2">
                    {effortOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          formData.effort === option.value
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            effort:
                              prev.effort === option.value
                                ? undefined
                                : option.value,
                          }))
                        }
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="date"
                    value={formData.dueDate || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dueDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee</label>
                <Input
                  value={formData.assignee || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      assignee: e.target.value || undefined,
                    }))
                  }
                  placeholder="Assign to..."
                />
              </div>

              {repositories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository</label>
                  <Select
                    value={formData.repositoryId ?? 'unassigned'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        repositoryId: value === 'unassigned' ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose repository" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {repositories.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id}>
                          {repo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Acceptance Criteria */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Acceptance Criteria
                </label>
                <div className="space-y-2">
                  {formData.acceptanceCriteria.map((criterion, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm">{criterion}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeCriterion(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      value={newCriterion}
                      onChange={(e) => setNewCriterion(e.target.value)}
                      placeholder="Add acceptance criterion..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCriterion()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addCriterion}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Auto-assign agent checkbox - only show for new tasks */}
              {!isEditing && (
                <div className="space-y-2">
                  <label
                    htmlFor="auto-assign-agent"
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors'
                    )}
                  >
                    <Checkbox
                      id="auto-assign-agent"
                      checked={formData.autoAssignAgent}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoAssignAgent: checked === true,
                        }))
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Robot className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Auto-assign to agent</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Claude Code will start working on this task immediately after creation
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4 pt-4 border-t">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isLoading}
                className="mr-auto"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.title.trim() || isLoading}>
              {isLoading ? (
                'Saving...'
              ) : isEditing ? (
                'Save Changes'
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
