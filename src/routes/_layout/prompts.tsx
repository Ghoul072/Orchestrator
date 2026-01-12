import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Card, CardContent } from '~/components/ui/card'
import { PlusIcon, SearchIcon, SparklesIcon } from 'lucide-react'
import { promptsQueryOptions, promptCategoriesQueryOptions } from '~/queries/prompts'
import { PromptCard } from '~/components/prompts/prompt-card'
import { PromptEditor } from '~/components/prompts/prompt-editor'
import type { Prompt } from '~/server/db/schema'

type PromptCategory = 'analysis' | 'security' | 'documentation' | 'review' | 'custom'

export const Route = createFileRoute('/_layout/prompts')({
  component: PromptsPage,
})

function PromptsPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<PromptCategory | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)

  // Fetch prompts
  const { data: prompts = [], isLoading } = useQuery(
    promptsQueryOptions({ category, search: search || undefined })
  )

  // Fetch categories
  const { data: categories = [] } = useQuery(promptCategoriesQueryOptions())

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setEditorOpen(true)
  }

  const handleCreate = () => {
    setEditingPrompt(null)
    setEditorOpen(true)
  }

  const handleEditorClose = (open: boolean) => {
    setEditorOpen(open)
    if (!open) {
      setEditingPrompt(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompt Library</h1>
          <p className="text-muted-foreground">
            Reusable prompt templates with variable support
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Prompt
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? undefined : v as PromptCategory)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompts Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SparklesIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No prompts yet</h3>
            <p className="text-center text-sm text-muted-foreground">
              {search || category
                ? 'No prompts match your filters.'
                : 'Create your first prompt template to get started.'}
            </p>
            {!search && !category && (
              <Button className="mt-4" onClick={handleCreate}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Prompt
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Prompt Editor Dialog */}
      <PromptEditor
        prompt={editingPrompt}
        open={editorOpen}
        onOpenChange={handleEditorClose}
      />
    </div>
  )
}
