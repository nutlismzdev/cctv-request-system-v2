/**
 * Utility functions for file uploads, validation, and compression
 */

/**
 * Convert bytes to human readable format
 */
export const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Compress an image file
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(file)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob((blob) => {
        cleanup()
        if (blob) {
          resolve(new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          }))
        } else {
          resolve(file)
        }
      }, file.type, quality)
    }

    img.onerror = () => {
      cleanup()
      resolve(file)
    }
    img.src = objectUrl
  })
}

/**
 * Download a file via fetch+blob to force "save as" on all browsers/in-app webviews.
 * Falls back to opening the URL in a new tab if blob fetch fails.
 */
export const downloadFile = async (url: string, filename?: string): Promise<void> => {
  try {
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename || url.split('/').pop() || 'download'
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Validate files with compression support
 */
export const validateFiles = async (
  files: FileList,
  options: {
    maxSize?: number // in bytes, default 500MB for videos, 10MB for images
    compressionThreshold?: number // in bytes, default 2MB
    allowedTypes?: string[]
    allowExtensions?: string[]
  } = {}
): Promise<{
  valid: File[]
  invalid: { file: File; reason: string }[]
}> => {
  const {
    maxSize,
    compressionThreshold = 2 * 1024 * 1024, // 2MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-m4v', 'video/webm', 'application/pdf'],
    allowExtensions = ['png', 'jpg', 'jpeg', 'heic', 'mp4', 'mov', 'avi', 'm4v', 'webm', 'pdf']
  } = options

  const invalid: { file: File; reason: string }[] = []
  const toCompress: File[] = []
  const passThrough: File[] = []

  for (const file of Array.from(files)) {
    const isVideo = file.type.startsWith('video/') ||
      /\.(mp4|mov|avi|m4v|webm)$/i.test(file.name)

    const defaultMaxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024
    const effectiveMaxSize = maxSize || defaultMaxSize

    if (file.size > effectiveMaxSize) {
      invalid.push({
        file,
        reason: isVideo
          ? `วิดีโอขนาดใหญ่เกิน ${humanSize(effectiveMaxSize)} (${humanSize(file.size)}) - วิดีโอต้องไม่เกิน 500MB`
          : `รูปภาพขนาดใหญ่เกิน ${humanSize(effectiveMaxSize)} (${humanSize(file.size)}) - รูปภาพต้องไม่เกิน 10MB`
      })
      continue
    }

    const isValidType = allowedTypes.includes(file.type) ||
      allowExtensions.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))

    if (!isValidType) {
      invalid.push({ file, reason: 'ประเภทไฟล์ไม่ถูกต้อง' })
      continue
    }

    // HEIC cannot be decoded by canvas — skip compression.
    const compressible = file.type.startsWith('image/') &&
      !/heic|heif/i.test(file.type) &&
      !/\.heic$/i.test(file.name) &&
      file.size > compressionThreshold

    if (compressible) toCompress.push(file)
    else passThrough.push(file)
  }

  // Compress all eligible images in parallel.
  const compressed = await Promise.all(
    toCompress.map(async (file) => {
      try {
        return await compressImage(file)
      } catch {
        return file
      }
    })
  )

  return { valid: [...passThrough, ...compressed], invalid }
}

/**
 * Create a debounced version of a function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
