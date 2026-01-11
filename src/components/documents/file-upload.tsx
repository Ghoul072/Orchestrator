import { useState, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Progress } from '~/components/ui/progress'
import {
  UploadCloudIcon,
  FileIcon,
  ImageIcon,
  FileTextIcon,
  XIcon,
  CheckCircleIcon,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { uploadFile, MAX_FILE_SIZE, ALLOWED_TYPES } from '~/server/functions/uploads'

interface FileUploadProps {
  projectId: string
  linkedTaskId?: string
  linkedMeetingId?: string
  onUploadComplete?: (documentId: string) => void
  className?: string
}

// File type icons
function getFileIcon(type: string) {
  if (type.startsWith('image/')) {
    return <ImageIcon className="h-8 w-8 text-blue-500" />
  }
  if (type === 'application/pdf') {
    return <FileTextIcon className="h-8 w-8 text-red-500" />
  }
  return <FileIcon className="h-8 w-8 text-gray-500" />
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({
  projectId,
  linkedTaskId,
  linkedMeetingId,
  onUploadComplete,
  className,
}: FileUploadProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Read file as base64
      const reader = new FileReader()
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Simulate progress
      setUploadProgress(30)
      await new Promise((r) => setTimeout(r, 100))
      setUploadProgress(60)

      const result = await uploadFile({
        data: {
          projectId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64Data,
          title: customTitle || undefined,
          linkedTaskId,
          linkedMeetingId,
        },
      })

      setUploadProgress(100)
      return result
    },
    onSuccess: (document) => {
      toast.success('File uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
      setSelectedFile(null)
      setCustomTitle('')
      setUploadProgress(0)
      onUploadComplete?.(document.id)
    },
    onError: (error) => {
      toast.error('Failed to upload file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      setUploadProgress(0)
    },
  })

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('File type not allowed', {
        description: `Allowed types: ${ALLOWED_TYPES.join(', ')}`,
      })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', {
        description: `Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`,
      })
      return
    }

    setSelectedFile(file)
    setCustomTitle('')
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setCustomTitle('')
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleInputChange}
      />

      {!selectedFile ? (
        <Card
          className={cn(
            'border-2 border-dashed cursor-pointer transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <CardContent className="flex flex-col items-center justify-center py-8">
            <UploadCloudIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, GIF, SVG, PDF up to {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              {getFileIcon(selectedFile.type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <Progress value={uploadProgress} className="mt-2 h-1" />
                )}

                {uploadProgress === 100 && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                    <CheckCircleIcon className="h-4 w-4" />
                    Uploaded
                  </div>
                )}

                {uploadProgress === 0 && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="title" className="text-xs">
                      Custom title (optional)
                    </Label>
                    <Input
                      id="title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={selectedFile.name}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              {uploadProgress === 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCancel}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>

            {uploadProgress === 0 && (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
