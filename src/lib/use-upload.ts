import { useState, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { validateFiles } from './upload-utils'

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

const DEFAULT_ACCEPT = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-m4v', 'video/webm',
  'application/pdf'
]

const initialProgress: UploadProgress = {
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
  retryCount: 0,
}

export const useUpload = (options: UploadOptions) => {
  const {
    endpoint,
    accept,
    withCompression = true,
    onSuccess,
    onError,
    additionalFormData,
  } = options

  // Callers commonly pass an inline `accept` array, so we key the memo on its joined string
  // form to ignore identity-only changes. We intentionally exclude `accept` from deps;
  // its content is fully captured by `acceptKey`.
  const acceptKey = (accept ?? DEFAULT_ACCEPT).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const acceptList = useMemo(() => accept ?? DEFAULT_ACCEPT, [acceptKey])

  const [progress, setProgress] = useState<UploadProgress>(initialProgress)
  const [error, setError] = useState<string | null>(null)

  // Refs avoid stale closures and re-creating the upload callback on every progress tick.
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const uploadingRef = useRef(false)
  const callbacksRef = useRef({ onSuccess, onError })
  callbacksRef.current = { onSuccess, onError }
  const additionalFormDataRef = useRef(additionalFormData)
  additionalFormDataRef.current = additionalFormData

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
    uploadingRef.current = false
  }, [])

  const reset = useCallback(() => {
    cancel()
    setProgress(initialProgress)
    setError(null)
  }, [cancel])

  const upload = useCallback(async (
    files: FileList | File[] | null,
    isRetry: boolean = false,
    extraFormData: Record<string, string> = {}
  ) => {
    if (!files || !files.length) return

    if (uploadingRef.current) {
      toast.warning('กำลังอัปโหลดอีกชุดอยู่ กรุณารอให้เสร็จก่อน')
      return
    }

    const fileList: FileList | File[] = files
    const fileArr = Array.from(fileList as ArrayLike<File>)

    const hasLargeImages = withCompression && fileArr.some(file =>
      file.type.startsWith('image/') && file.size > 2 * 1024 * 1024
    )
    if (hasLargeImages) toast.info('กำลังบีบอัดรูปภาพขนาดใหญ่...')

    // validateFiles expects a FileList-like; build a DataTransfer when given an array.
    const fileListLike = fileList instanceof FileList
      ? fileList
      : (() => {
          const dt = new DataTransfer()
          fileArr.forEach(f => dt.items.add(f))
          return dt.files
        })()

    const { valid: validFiles, invalid: invalidFiles } = await validateFiles(fileListLike, {
      allowedTypes: acceptList,
    })

    if (invalidFiles.length > 0) {
      const errorMsg = `ไฟล์บางไฟล์ไม่ถูกต้อง:\n${invalidFiles.map(i => `${i.file.name}: ${i.reason}`).join('\n')}`
      toast.error(errorMsg)
      setError(errorMsg)
      if (validFiles.length === 0) return
    }

    const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0)

    setProgress({
      ...initialProgress,
      uploading: true,
      currentFile: validFiles[0]?.name || '',
      totalSize,
      totalFiles: validFiles.length,
      failedFiles: invalidFiles.map(item => ({ name: item.file.name, reason: item.reason })),
      status: 'preparing',
      retryCount: isRetry ? 1 : 0,
    })

    uploadingRef.current = true

    const formData = new FormData()
    validFiles.forEach(f => formData.append('files', f))
    Object.entries({ ...(additionalFormDataRef.current || {}), ...extraFormData }).forEach(([key, value]) => {
      formData.append(key, value)
    })

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    let lastSampleTime = Date.now()
    let lastSampleBytes = 0

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return
      const now = Date.now()
      const progressPercent = Math.round((e.loaded / e.total) * 100)

      if (now - lastSampleTime > 750) {
        const timeDiff = now - lastSampleTime
        const bytesDiff = e.loaded - lastSampleBytes
        const speed = Math.max(0, Math.round((bytesDiff / timeDiff) * 1000 / 1024)) // KB/s
        const remainingBytes = totalSize - e.loaded
        const estimatedTime = speed > 0 ? Math.ceil(remainingBytes / (speed * 1024)) : 0

        lastSampleTime = now
        lastSampleBytes = e.loaded

        setProgress(prev => ({
          ...prev,
          progress: progressPercent,
          uploadedSize: e.loaded,
          speed,
          estimatedTime,
          status: 'uploading',
        }))
      } else {
        setProgress(prev => ({
          ...prev,
          progress: progressPercent,
          uploadedSize: e.loaded,
          status: 'uploading',
        }))
      }
    })

    xhr.addEventListener('load', () => {
      uploadingRef.current = false
      xhrRef.current = null

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.success) {
            const successCount = data.data?.length ?? validFiles.length
            const skippedCount = invalidFiles.length
            let message = `อัปโหลดสำเร็จ ${successCount} ไฟล์`
            if (skippedCount > 0) message += ` (ข้าม ${skippedCount} ไฟล์ที่ไม่ถูกต้อง)`
            toast.success(message)

            setProgress({
              ...initialProgress,
              progress: 100,
              uploadedSize: totalSize,
              totalSize,
              currentFileIndex: validFiles.length,
              totalFiles: validFiles.length,
              completedFiles: validFiles.map(f => f.name),
              failedFiles: invalidFiles.map(item => ({ name: item.file.name, reason: item.reason })),
              status: 'completed',
            })
            setError(null)
            callbacksRef.current.onSuccess?.(data)
            return
          }
          throw new Error(data.message || 'อัปโหลดไม่สำเร็จ')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'การตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง'
          toast.error(msg)
          setProgress(prev => ({ ...prev, status: 'error', uploading: false }))
          setError(msg)
          callbacksRef.current.onError?.(msg)
        }
      } else {
        const msg = `HTTP ${xhr.status}: ${xhr.statusText || 'อัปโหลดไม่สำเร็จ'}`
        toast.error(msg)
        setProgress(prev => ({ ...prev, status: 'error', uploading: false }))
        setError(msg)
        callbacksRef.current.onError?.(msg)
      }
    })

    xhr.addEventListener('error', () => {
      uploadingRef.current = false
      xhrRef.current = null
      const errorMsg = 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย'
      toast.error(errorMsg)
      setProgress(prev => ({ ...prev, status: 'error', uploading: false }))
      setError(errorMsg)
      callbacksRef.current.onError?.(errorMsg)
    })

    xhr.addEventListener('abort', () => {
      uploadingRef.current = false
      xhrRef.current = null
      setProgress(prev => ({ ...prev, status: 'cancelled', uploading: false }))
      setError('การอัปโหลดถูกยกเลิก')
    })

    xhr.open('POST', endpoint)
    xhr.send(formData)
  }, [endpoint, withCompression, acceptList])

  return {
    upload,
    progress,
    error,
    reset,
    cancel,
  }
}
