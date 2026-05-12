'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  FileText,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Check,
  AlertCircle,
  FileX,
} from 'lucide-react'
import { toast } from 'sonner'

// Types
interface ServerFile {
  name: string
  path: string
  size: number
  sizeFormatted: string
  modifiedAt: string
  extension: string
}

interface ServerFileBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportId: number
  category?: 'idcopy' | 'operation' | string
  onSuccess?: () => void
}

export function ServerFileBrowser({
  open,
  onOpenChange,
  reportId,
  category = 'idcopy',
  onSuccess,
}: ServerFileBrowserProps) {
  const [files, setFiles] = useState<ServerFile[]>([])
  const [filteredFiles, setFilteredFiles] = useState<ServerFile[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFile, setSelectedFile] = useState<ServerFile | null>(null)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverPath, setServerPath] = useState<string>('D:\\Scan')

  // Load files from server
  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/server-files')
      const data = await res.json()

      if (data.success) {
        setFiles(data.data.files)
        setFilteredFiles(data.data.files)
        setServerPath(data.data.path)
      } else {
        setError(data.error || 'ไม่สามารถโหลดไฟล์ได้')
        toast.error(data.error || 'ไม่สามารถโหลดไฟล์ได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load files when modal opens
  useEffect(() => {
    if (open) {
      loadFiles()
      setSelectedFile(null)
      setSearchTerm('')
    }
  }, [open, loadFiles])

  // Filter files based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredFiles(files)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = files.filter(file =>
      file.name.toLowerCase().includes(term)
    )
    setFilteredFiles(filtered)
  }, [searchTerm, files])

  // Copy selected file to attachments
  const handleCopyFile = async () => {
    if (!selectedFile) return

    setCopying(true)
    try {
      const res = await fetch('/api/server-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          reportId,
          category,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message)
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(data.error || 'ไม่สามารถแนบไฟล์ได้')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการแนบไฟล์')
    } finally {
      setCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-[var(--primary)]" />
            Browse ไฟล์จาก Server
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            เลือกไฟล์ PDF จาก {serverPath}
          </p>
        </DialogHeader>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาไฟล์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadFiles}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* File Count */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filteredFiles.length} ไฟล์
            </Badge>
            {searchTerm && (
              <span className="text-muted-foreground">
                (ค้นหา: &quot;{searchTerm}&quot;)
              </span>
            )}
          </div>
          {selectedFile && (
            <Badge className="bg-[var(--primary)]/10 text-[var(--primary)]">
              เลือก: {selectedFile.name}
            </Badge>
          )}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[300px] max-h-[400px]">
          {loading ? (
            // Loading skeleton
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
              <Button
                variant="outline"
                onClick={loadFiles}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                ลองใหม่
              </Button>
            </div>
          ) : filteredFiles.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              {searchTerm ? (
                <>
                  <FileX className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    ไม่พบไฟล์ที่ตรงกับ &quot;{searchTerm}&quot;
                  </p>
                </>
              ) : (
                <>
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    ไม่พบไฟล์ PDF ใน {serverPath}
                  </p>
                </>
              )}
            </div>
          ) : (
            // File list
            <div className="divide-y">
              {filteredFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors ${
                    selectedFile?.path === file.path
                      ? 'bg-[var(--primary)]/5 hover:bg-[var(--primary)]/5 border-l-4 border-[var(--primary)]'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  {/* File Icon */}
                  <div className={`p-2 rounded-lg ${
                    selectedFile?.path === file.path
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    <FileText className="h-5 w-5" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${
                      selectedFile?.path === file.path
                        ? 'text-[var(--primary)]'
                        : 'text-slate-900'
                    }`}>
                      {file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {file.sizeFormatted} • แก้ไขล่าสุด: {file.modifiedAt}
                    </p>
                  </div>

                  {/* Selected Indicator */}
                  {selectedFile?.path === file.path && (
                    <div className="flex items-center gap-1 text-[var(--primary)]">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copying}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleCopyFile}
            disabled={!selectedFile || copying}
            className="min-w-[120px]"
          >
            {copying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                กำลังแนบ...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                แนบไฟล์ที่เลือก
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
