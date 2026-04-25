import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { validateFiles, humanSize } from './upload-utils'

export interface UploadProgress {
  uploading: boolean
  progress: number
  currentFile: string
  uploadedSize: number
  totalSize: number
  currentFileIndex: number
  totalFiles: number
  completedFiles: string[]
  failedFiles: { name: string; reason: string }[]
  speed: number // KB/s
  estimatedTime: number // seconds
  status: 'preparing' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled'
  retryCount: number
}

export interface UploadOptions {
  endpoint: string
  accept?: string[]
  withCompression?: boolean

  onSuccess?: (data: unknown) => void
  onError?: (error: string) => void
  additionalFormData?: Record<string, string>
}

export const useUpload = (options: UploadOptions) => {
  const {
    endpoint,
    accept = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-m4v', 'video/webm', 'application/pdf'],
    withCompression = true,

    onSuccess,
    onError,
    additionalFormData = {}
  } = options

  const [progress, setProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    currentFile: '',
    uploadedSize: 0,
    totalSize: 0,
    currentFileIndex: 0,
    totalFiles: 0,
    completedFiles: [],
    failedFiles: [],
    speed: 0,
    estimatedTime: 0,
    status: 'preparing',
    retryCount: 0
  })

  const [error, setError] = useState<string | null>(null)
 

  const reset = useCallback(() => {
    setProgress({
      uploading: false,
      progress: 0,
      currentFile: '',
      uploadedSize: 0,
      totalSize: 0,
      currentFileIndex: 0,
      totalFiles: 0,
      completedFiles: [],
      failedFiles: [],
      speed: 0,
      estimatedTime: 0,
      status: 'preparing',
      retryCount: 0
    })
    setError(null)
  
  }, [])

  const upload = useCallback(async (files: FileList | null, isRetry: boolean = false, extraFormData: Record<string, string> = {}) => {
    if (!files || !files.length) return

    // Compress images before upload if enabled
    const hasLargeImages = withCompression && Array.from(files).some(file =>
      file.type.startsWith('image/') && file.size > 2 * 1024 * 1024
    )

    if (hasLargeImages) {
      // Show compression indicator
      toast.info('กำลังบีบอัดรูปภาพขนาดใหญ่...')
    }

    // Validate and compress files
    const { valid: validFiles, invalid: invalidFiles } = await validateFiles(files, {
      allowedTypes: accept
    })

    // Store files for potential retries on first attempt
    if (!isRetry) {
 
    }

    // Show validation errors
    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.map(item => `${item.file.name}: ${item.reason}`).join('\n')
      const errorMsg = `ไฟล์บางไฟล์ไม่ถูกต้อง:\n${errorMessage}`
      toast.error(errorMsg)
      setError(errorMsg)
      if (validFiles.length === 0) return
    }

    const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0)

    // Initialize progress state
    setProgress({
      uploading: true,
      progress: 0,
      currentFile: validFiles[0]?.name || '',
      uploadedSize: 0,
      totalSize: totalSize,
      currentFileIndex: 0,
      totalFiles: validFiles.length,
      completedFiles: [],
      failedFiles: invalidFiles.map(item => ({ name: item.file.name, reason: item.reason })),
      speed: 0,
      estimatedTime: 0,
      status: 'preparing',
      retryCount: 0
    })

    try {
      // Use XMLHttpRequest for accurate progress tracking
      const xhr = new XMLHttpRequest()

      // Prepare and send form data
      const formData = new FormData()
      validFiles.forEach(f => formData.append('files', f))

      // Add additional form data
      Object.entries({ ...additionalFormData, ...extraFormData }).forEach(([key, value]) => {
        formData.append(key, value)
      })

      console.log(`Uploading ${validFiles.length} files to ${endpoint}, total size: ${humanSize(totalSize)}`)

      let lastProgressTime = Date.now()

      // Enhanced progress tracking with speed calculation
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const currentTime = Date.now()
          const progressPercent = Math.round((e.loaded / e.total) * 100)

          // Calculate upload speed every second
          if (currentTime - lastProgressTime > 1000) {
            const timeDiff = currentTime - lastProgressTime
            const bytesDiff = e.loaded - progress.uploadedSize
            const speed = Math.round((bytesDiff / timeDiff) * 1000 / 1024) // KB/s

            const remainingBytes = totalSize - e.loaded
            const estimatedTime = speed > 0 ? Math.ceil(remainingBytes / (speed * 1024)) : 0

            setProgress(prev => ({
              ...prev,
              progress: progressPercent,
              uploadedSize: e.loaded,
              speed: speed,
              estimatedTime: estimatedTime,
              status: 'uploading',
            }))

            lastProgressTime = currentTime
          } else {
            // Update progress without speed calculation
            setProgress(prev => ({
              ...prev,
              progress: progressPercent,
              uploadedSize: e.loaded,
              status: 'uploading',
            }))
          }
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText)

            if (data.success) {
              // Enhanced success message
              const successCount = data.data?.length || validFiles.length
              const skippedCount = invalidFiles.length
              let message = `อัปโหลดสำเร็จ ${successCount} ไฟล์`
              if (skippedCount > 0) {
                message += ` (ข้าม ${skippedCount} ไฟล์ที่ไม่ถูกต้อง)`
              }
              toast.success(message)

              // Reset progress state
              setProgress({
                uploading: false,
                progress: 100,
                currentFile: '',
                uploadedSize: totalSize,
                totalSize: totalSize,
                currentFileIndex: validFiles.length,
                totalFiles: validFiles.length,
                completedFiles: validFiles.map(f => f.name),
                failedFiles: invalidFiles.map(item => ({ name: item.file.name, reason: item.reason })),
                speed: 0,
                estimatedTime: 0,
                status: 'completed',
                retryCount: 0
              })

              setError(null)
              onSuccess?.(data)
            } else {
              throw new Error(data.message || 'อัปโหลดไม่สำเร็จ')
            }
          } catch {
            throw new Error('การตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง')
          }
        } else {
          throw new Error(`HTTP ${xhr.status}: ${xhr.statusText}`)
        }
      })

      xhr.addEventListener('error', () => {
        const errorMsg = 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย'
        toast.error(errorMsg)
        setProgress(prev => ({ ...prev, status: 'error', uploading: false }))
        setError(errorMsg)
        onError?.(errorMsg)
      })

      xhr.addEventListener('abort', () => {
        setProgress(prev => ({ ...prev, status: 'cancelled', uploading: false }))
        setError('การอัปโหลดถูกยกเลิก')
      })

      xhr.open('POST', endpoint)
      xhr.send(formData)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดไม่คาดคิด'
      toast.error(errorMsg)
      setProgress(prev => ({ ...prev, status: 'error', uploading: false }))
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [endpoint, accept, withCompression, onSuccess, onError, additionalFormData, progress.uploadedSize])

  return {
    upload,
    progress,
    error,
    reset
  }
}
