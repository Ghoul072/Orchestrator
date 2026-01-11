import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { XIcon, PlusIcon } from 'lucide-react'
import { createPrompt, updatePrompt } from '~/server/functions/prompts'
import type { Prompt } from '~/server/db/schema'

type PromptCategory = 'analysis' | 'security' | 'documentation' | 'review' | 'custom'

type PromptVariable = {
  name: string
  type: 'string' | 'text' | 'select'
  options?: string[]
  default?: string
}

interface PromptEditorProps {
  prompt?: Prompt | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptEditor({ prompt, open, onOpenChange }: PromptEditorProps) {
  const queryClient = useQueryClient()
  const isEditing = !!prompt

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<PromptCategory>('custom')
  const [variables, setVariables] = useState<PromptVariable[]>([])
  const [newVariableName, setNewVariableName] = useState('')

  // Reset form when prompt changes
  useEffect(() => {
    if (prompt) {
      setName(prompt.name)
      setDescription(prompt.description || '')
      setContent(prompt.content)
      setCategory(prompt.category)
      setVariables(prompt.variables || [])
    } else {
      setName('')
      setDescription('')
      setContent('')
      setCategory('custom')
      setVariables([])
    }
  }, [prompt, open])

  // Extract variables from content (format: {{variable_name}})
  const extractVariables = () => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || []
    const extracted = matches.map(m => m.replace(/[{}]/g, ''))
    const unique = [...new Set(extracted)]

    const newVars: PromptVariable[] = unique.map(name => {
      // Keep existing variable settings if already defined
      const existing = variables.find(v => v.name === name)
      return existing || { name, type: 'string' as const }
    })

    setVariables(newVars)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createPrompt({
        data: {
          name,
          description: description || undefined,
          content,
          category,
          variables: variables.length > 0 ? variables : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Prompt created')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error('Failed to create prompt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePrompt({
        data: {
          id: prompt!.id,
          name,
          description: description || undefined,
          content,
          category,
          variables: variables.length > 0 ? variables : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Prompt updated')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['prompt', prompt!.id] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error('Failed to update prompt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  const addVariable = () => {
    if (newVariableName.trim() && !variables.some(v => v.name === newVariableName.trim())) {
      setVariables([...variables, { name: newVariableName.trim(), type: 'string' }])
      setNewVariableName('')
    }
  }

  const removeVariable = (varName: string) => {
    setVariables(variables.filter(v => v.name !== varName))
  }

  const updateVariableType = (varName: string, type: PromptVariable['type']) => {
    setVariables(variables.map(v =>
      v.name === varName ? { ...v, type } : v
    ))
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Prompt' : 'Create Prompt'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the prompt template. Use {{variable}} syntax for variables.'
              : 'Create a reusable prompt template. Use {{variable}} syntax for variables.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bug Fix Template"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as PromptCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this prompt does"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Prompt Content</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={extractVariables}
              >
                Extract Variables
              </Button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt template. Use {{variable_name}} for dynamic values."
              rows={8}
              className="font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Variables</Label>
            <div className="space-y-2 mb-2">
              {variables.map((variable) => (
                <div key={variable.name} className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    {`{{${variable.name}}}`}
                  </Badge>
                  <Select
                    value={variable.type}
                    onValueChange={(v) => updateVariableType(variable.name, v as PromptVariable['type'])}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Short text</SelectItem>
                      <SelectItem value="text">Long text</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeVariable(variable.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {variables.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  No variables defined. Click "Extract Variables" to detect them from content.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newVariableName}
                onChange={(e) => setNewVariableName(e.target.value)}
                placeholder="variable_name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addVariable()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addVariable}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
