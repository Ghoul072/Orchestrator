import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent } from '~/components/ui/card'
import { PencilIcon, EyeIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { cn } from '~/lib/utils'

interface MermaidBlockProps {
  code: string
  onChange?: (code: string) => void
  editable?: boolean
  className?: string
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
})

export function MermaidBlock({
  code,
  onChange,
  editable = true,
  className,
}: MermaidBlockProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCode, setEditedCode] = useState(code)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEditedCode(code)
  }, [code])

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code.trim()) {
        setSvg('')
        setError(null)
        return
      }

      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        setSvg(renderedSvg)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
        setSvg('')
      }
    }

    if (!isEditing) {
      renderDiagram()
    }
  }, [code, isEditing])

  const handleSave = () => {
    onChange?.(editedCode)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedCode(code)
    setIsEditing(false)
  }

  if (isEditing && editable) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">Edit Mermaid Diagram</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          <Textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            placeholder="Enter Mermaid diagram code..."
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Supports flowcharts, sequence diagrams, class diagrams, and more.{' '}
            <a
              href="https://mermaid.js.org/syntax/flowchart.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              View syntax
            </a>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          Mermaid Diagram
        </span>
        {editable && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <PencilIcon className="mr-1 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>
      <CardContent className="p-4">
        {error ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive">
            <WarningCircleIcon className="h-5 w-5" />
            <div>
              <p className="font-medium">Diagram Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : svg ? (
          <div
            ref={containerRef}
            className="flex justify-center overflow-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <EyeIcon className="mr-2 h-5 w-5" />
            No diagram to display
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Preset templates for common diagram types
 */
export const mermaidTemplates = {
  flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,

  sequence: `sequenceDiagram
    participant A as User
    participant B as System
    A->>B: Request
    B-->>A: Response`,

  classDiagram: `classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,

  erDiagram: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : includes`,

  gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :a1, 2024-01-01, 30d
    Task 2 :after a1, 20d
    section Phase 2
    Task 3 :2024-02-15, 25d`,
}
