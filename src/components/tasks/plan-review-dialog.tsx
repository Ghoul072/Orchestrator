import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import {
  CheckCircle,
  XCircle,
  CaretDown,
  CaretRight,
  FilePlus,
  FileX,
  Pencil,
  Warning,
  Question,
  Lightning,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import type { ExecutionPlan, PlanStep } from '~/server/db/schema'

interface PlanReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTitle: string
  plan: ExecutionPlan
  onApprove: () => void
  onReject: () => void
  onRequestChanges: (feedback: string) => void
}

export function PlanReviewDialog({
  open,
  onOpenChange,
  taskTitle,
  plan,
  onApprove,
  onReject,
  onRequestChanges,
}: PlanReviewDialogProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      onApprove()
      onOpenChange(false)
    } catch {
      toast.error('Failed to approve plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    try {
      onReject()
      onOpenChange(false)
    } catch {
      toast.error('Failed to reject plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!feedback.trim()) {
      toast.error('Please provide feedback for the requested changes')
      return
    }
    setIsSubmitting(true)
    try {
      onRequestChanges(feedback.trim())
      setFeedback('')
      setShowFeedback(false)
    } catch {
      toast.error('Failed to request changes')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightning weight="fill" className="h-5 w-5 text-amber-500" />
            Review Execution Plan
          </DialogTitle>
          <DialogDescription>
            Review the agent's plan before execution: {taskTitle}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Summary */}
            <div>
              <h3 className="mb-2 text-sm font-medium">Summary</h3>
              <p className="text-sm text-muted-foreground">{plan.summary}</p>
            </div>

            {/* Steps */}
            <div>
              <h3 className="mb-2 text-sm font-medium">
                Steps ({plan.steps.length})
              </h3>
              <div className="space-y-2">
                {plan.steps.map((step, index) => (
                  <StepCard key={step.id} step={step} index={index} />
                ))}
              </div>
            </div>

            {/* Files */}
            {plan.files.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Files to be modified ({plan.files.length})
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  {plan.files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileActionIcon action={file.action} />
                      <code className="text-xs">{file.path}</code>
                      <Badge variant="outline" className="text-xs">
                        {file.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {plan.risks && plan.risks.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-600">
                  <Warning weight="fill" className="h-4 w-4" />
                  Potential Risks
                </h3>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <ul className="space-y-1 text-sm">
                    {plan.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Assumptions */}
            {plan.assumptions && plan.assumptions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Assumptions
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {plan.assumptions.map((assumption, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span>•</span>
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Questions */}
            {plan.openQuestions && plan.openQuestions.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Question weight="fill" className="h-4 w-4" />
                  Open Questions
                </h3>
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                  <ul className="space-y-1 text-sm">
                    {plan.openQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-600">?</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Request Changes */}
            {showFeedback && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Request Changes</h3>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe what changes you'd like the agent to make to this plan..."
                  rows={3}
                  autoFocus
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowFeedback(false)
                      setFeedback('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRequestChanges}
                    disabled={!feedback.trim() || isSubmitting}
                  >
                    <ArrowsClockwise className="mr-1 h-3 w-3" />
                    Regenerate Plan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          {!showFeedback && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedback(true)}
                disabled={isSubmitting}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Request Changes
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Execute
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Step card component
function StepCard({ step, index }: { step: PlanStep; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50">
            <Badge variant="outline" className="h-6 w-6 justify-center p-0">
              {index + 1}
            </Badge>
            <span className="flex-1 font-medium text-sm">{step.title}</span>
            {expanded ? (
              <CaretDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <CaretRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 py-2 text-sm text-muted-foreground">
            {step.details}

            {step.outputs && step.outputs.length > 0 && (
              <div className="mt-2">
                <span className="text-xs font-medium">Outputs: </span>
                {step.outputs.map((output, i) => (
                  <Badge key={i} variant="secondary" className="mr-1 text-xs">
                    {output}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// File action icon component
function FileActionIcon({ action }: { action: 'create' | 'modify' | 'delete' }) {
  switch (action) {
    case 'create':
      return <FilePlus className="h-4 w-4 text-green-500" />
    case 'modify':
      return <Pencil className="h-4 w-4 text-blue-500" />
    case 'delete':
      return <FileX className="h-4 w-4 text-red-500" />
  }
}
