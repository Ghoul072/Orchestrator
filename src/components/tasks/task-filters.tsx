import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { FunnelIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskFilters {
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  hasBlockers?: boolean
  hasDueDate?: boolean
  assignee?: string
}

interface TaskFiltersProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  assignees?: string[]
  className?: string
}

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-slate-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' },
]

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-green-500' },
]

export function TaskFiltersPopover({
  filters,
  onFiltersChange,
  assignees = [],
  className,
}: TaskFiltersProps) {
  const [open, setOpen] = useState(false)

  const activeFilterCount =
    filters.statuses.length +
    filters.priorities.length +
    (filters.hasBlockers ? 1 : 0) +
    (filters.hasDueDate ? 1 : 0) +
    (filters.assignee ? 1 : 0)

  const toggleStatus = (status: TaskStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status]
    onFiltersChange({ ...filters, statuses: newStatuses })
  }

  const togglePriority = (priority: TaskPriority) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority]
    onFiltersChange({ ...filters, priorities: newPriorities })
  }

  const clearFilters = () => {
    onFiltersChange({
      statuses: [],
      priorities: [],
      hasBlockers: undefined,
      hasDueDate: undefined,
      assignee: undefined,
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <FunnelIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          {/* Status filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={filters.statuses.includes(option.value)}
                    onCheckedChange={() => toggleStatus(option.value)}
                  />
                  <Label
                    htmlFor={`status-${option.value}`}
                    className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                  >
                    <div className={cn('h-2 w-2 rounded-full', option.color)} />
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Priority filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Priority</Label>
            <div className="grid grid-cols-2 gap-2">
              {priorityOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`priority-${option.value}`}
                    checked={filters.priorities.includes(option.value)}
                    onCheckedChange={() => togglePriority(option.value)}
                  />
                  <Label
                    htmlFor={`priority-${option.value}`}
                    className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                  >
                    <div className={cn('h-2 w-2 rounded-full', option.color)} />
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Additional filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-blockers"
                  checked={filters.hasBlockers ?? false}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      hasBlockers: checked ? true : undefined,
                    })
                  }
                />
                <Label htmlFor="has-blockers" className="text-sm font-normal cursor-pointer">
                  Has blockers
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-due-date"
                  checked={filters.hasDueDate ?? false}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      hasDueDate: checked ? true : undefined,
                    })
                  }
                />
                <Label htmlFor="has-due-date" className="text-sm font-normal cursor-pointer">
                  Has due date
                </Label>
              </div>
            </div>
          </div>

          {/* Assignee filter (if there are assignees) */}
          {assignees.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignee</Label>
                <div className="space-y-2">
                  {assignees.map((assignee) => (
                    <div key={assignee} className="flex items-center space-x-2">
                      <Checkbox
                        id={`assignee-${assignee}`}
                        checked={filters.assignee === assignee}
                        onCheckedChange={(checked) =>
                          onFiltersChange({
                            ...filters,
                            assignee: checked ? assignee : undefined,
                          })
                        }
                      />
                      <Label
                        htmlFor={`assignee-${assignee}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {assignee}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Active filter badges that can be cleared
 */
export function ActiveFilters({
  filters,
  onFiltersChange,
  className,
}: TaskFiltersProps) {
  if (
    filters.statuses.length === 0 &&
    filters.priorities.length === 0 &&
    !filters.hasBlockers &&
    !filters.hasDueDate &&
    !filters.assignee
  ) {
    return null
  }

  const removeStatus = (status: TaskStatus) => {
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.filter((s) => s !== status),
    })
  }

  const removePriority = (priority: TaskPriority) => {
    onFiltersChange({
      ...filters,
      priorities: filters.priorities.filter((p) => p !== priority),
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Active filters:</span>

      {filters.statuses.map((status) => {
        const option = statusOptions.find((o) => o.value === status)
        return (
          <Badge key={status} variant="secondary" className="gap-1 pr-1">
            <div className={cn('h-2 w-2 rounded-full', option?.color)} />
            {option?.label}
            <button
              onClick={() => removeStatus(status)}
              className="ml-1 rounded-full hover:bg-muted"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {filters.priorities.map((priority) => {
        const option = priorityOptions.find((o) => o.value === priority)
        return (
          <Badge key={priority} variant="secondary" className="gap-1 pr-1">
            {option?.label}
            <button
              onClick={() => removePriority(priority)}
              className="ml-1 rounded-full hover:bg-muted"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {filters.hasBlockers && (
        <Badge variant="secondary" className="gap-1 pr-1">
          Has blockers
          <button
            onClick={() => onFiltersChange({ ...filters, hasBlockers: undefined })}
            className="ml-1 rounded-full hover:bg-muted"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {filters.hasDueDate && (
        <Badge variant="secondary" className="gap-1 pr-1">
          Has due date
          <button
            onClick={() => onFiltersChange({ ...filters, hasDueDate: undefined })}
            className="ml-1 rounded-full hover:bg-muted"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {filters.assignee && (
        <Badge variant="secondary" className="gap-1 pr-1">
          {filters.assignee}
          <button
            onClick={() => onFiltersChange({ ...filters, assignee: undefined })}
            className="ml-1 rounded-full hover:bg-muted"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  )
}
