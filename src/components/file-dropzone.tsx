'use client'

import React, { useCallback, useState } from 'react'
import { Upload, FileText, Image as ImageIcon, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onUpload: (files: FileList) => void
  children?: React.ReactNode
  className?: string
  dropzoneClassName?: string
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  accept = "image/*,video/*,.pdf",
  multiple = true,
  disabled = false,
  onUpload,
  children,
  className,
  dropzoneClassName
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewFiles, setPreviewFiles] = useState<File[]>([])

  const handleFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files)
    setPreviewFiles(fileArray)
    onUpload(files)
  }, [onUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [disabled, handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input value to allow re-uploading the same file
    e.target.value = ''
  }, [handleFiles])

  const removePreviewFile = useCallback((index: number) => {
    setPreviewFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />
    if (file.type.startsWith('video/')) return <Video className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className={className}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--muted-foreground)] hover:border-[var(--primary)]",
          disabled && "opacity-50 cursor-not-allowed",
          dropzoneClassName
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="เลือกไฟล์"
        />

        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="h-12 w-12 text-[var(--muted-foreground)]" />
          </div>

          <div>
            <p className="text-lg font-medium text-[var(--foreground)]">
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              รองรับ {accept.replace(/\*/g, '').replace(/,/g, ', ')}
            </p>
          </div>

          {children && (
            <div className="text-sm text-[var(--muted-foreground)]">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* File Preview */}
      {previewFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">
            ไฟล์ที่เลือก ({previewFiles.length} ไฟล์):
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {previewFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between p-2 bg-[var(--muted)] rounded-md text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(file)}
                  <span className="truncate text-[var(--foreground)]">{file.name}</span>
                  <span className="text-[var(--muted-foreground)] text-xs">
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePreviewFile(index)}
                  className="h-6 w-6 p-0 hover:bg-[var(--destructive)] hover:text-[var(--destructive-foreground)]"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
