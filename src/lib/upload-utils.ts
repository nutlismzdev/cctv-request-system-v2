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

    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        } else {
          resolve(file) // Fallback to original
        }
      }, file.type, quality)
    }

    img.onerror = () => resolve(file) // Fallback to original
    img.src = URL.createObjectURL(file)
  })
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

  const valid: File[] = []
  const invalid: { file: File; reason: string }[] = []

  for (const file of Array.from(files)) {
    // Determine max size based on file type
    const isVideo = file.type.startsWith('video/') ||
      /\.(mp4|mov|avi|m4v|webm)$/i.test(file.name)

    const defaultMaxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024 // 500MB for videos, 10MB for images
    const effectiveMaxSize = maxSize || defaultMaxSize

    // Check file size
    if (file.size > effectiveMaxSize) {
      const reason = isVideo
        ? `วิดีโอขนาดใหญ่เกิน ${humanSize(effectiveMaxSize)} (${humanSize(file.size)}) - วิดีโอต้องไม่เกิน 500MB`
        : `รูปภาพขนาดใหญ่เกิน ${humanSize(effectiveMaxSize)} (${humanSize(file.size)}) - รูปภาพต้องไม่เกิน 10MB`

      invalid.push({
        file,
        reason
      })
      continue
    }

    // Check file type
    const isValidType = allowedTypes.includes(file.type) ||
      allowExtensions.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))

    if (!isValidType) {
      invalid.push({ file, reason: 'ประเภทไฟล์ไม่ถูกต้อง' })
      continue
    }

    // Compress large images
    if (file.type.startsWith('image/') && file.size > compressionThreshold) {
      try {
        console.log(`Compressing image: ${file.name} (${humanSize(file.size)})`)
        const compressedFile = await compressImage(file)
        console.log(`Compressed to: ${humanSize(compressedFile.size)}`)
        valid.push(compressedFile)
      } catch (error) {
        console.warn(`Compression failed for ${file.name}, using original:`, error)
        valid.push(file) // Fallback to original
      }
    } else {
      valid.push(file)
    }
  }

  return { valid, invalid }
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
