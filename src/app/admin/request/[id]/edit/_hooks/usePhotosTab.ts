'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useUpload } from '@/lib/use-upload'
import type { Media, Report, UploadResponse } from '../_types'

interface UsePhotosTabArgs {
  report: Report | null
  cctvMedia: Media[]
  setCctvMedia: React.Dispatch<React.SetStateAction<Media[]>>
}

export function usePhotosTab({ report, cctvMedia, setCctvMedia }: UsePhotosTabArgs) {
  const cctvUpload = useUpload({
    endpoint: `/api/reports/${report?.report_id}/photos`,
    withCompression: true,
    onSuccess: (data) => {
      const response = data as UploadResponse
      const added: Media[] = (response.data || []).map((x: unknown) => ({
        ...(x as Media),
        published: 'false',
        approval_status: 'รอตรวจสอบ',
      }))
      setCctvMedia(prev => [...added, ...prev])
    },
  })

  const deleteCctvMedia = useCallback(
    async (mediaId: string, retryCount: number = 0): Promise<void> => {
      if (!report) return
      if (retryCount === 0 && !confirm('ต้องการลบไฟล์นี้หรือไม่ ลบแล้วจะไม่สามารถกู้คืนได้')) return

      const MAX_RETRIES = 2
      const RETRY_DELAY = 1000

      try {
        const mediaItem = cctvMedia.find(m => m.id === mediaId)
        if (!mediaItem) {
          toast.error('ไม่พบไฟล์ที่ต้องการลบ')
          return
        }

        const retryText = retryCount > 0 ? ` (ลองใหม่ ${retryCount}/${MAX_RETRIES})` : ''
        const toastId = toast.loading(`กำลังลบไฟล์ ${mediaItem.file_name}...${retryText}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        try {
          const res = await fetch(`/api/reports/${report.report_id}/photos?mediaId=${mediaId}`, {
            method: 'DELETE',
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }

          const data = await res.json()

          if (data.success) {
            setCctvMedia(prev => prev.filter(x => String(x.id) !== String(mediaId)))
            toast.dismiss(toastId)
            toast.success(`ลบไฟล์ ${mediaItem.file_name} เรียบร้อยแล้ว`)
            console.log(`File deleted successfully: ${mediaItem.file_name} (${mediaItem.id})`)
          } else {
            throw new Error(data.message || 'ลบไฟล์ไม่สำเร็จ')
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)

          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            if (retryCount < MAX_RETRIES) {
              toast.dismiss(toastId)
              console.warn(`Delete timeout, retrying... (${retryCount + 1}/${MAX_RETRIES})`)
              setTimeout(() => deleteCctvMedia(mediaId, retryCount + 1), RETRY_DELAY)
              return
            } else {
              throw new Error('การเชื่อมต่อใช้เวลานานเกินไป')
            }
          }

          if (fetchError instanceof Error &&
              (fetchError.message.includes('fetch') || fetchError.message.includes('network'))) {
            if (retryCount < MAX_RETRIES) {
              toast.dismiss(toastId)
              console.warn(`Network error, retrying... (${retryCount + 1}/${MAX_RETRIES})`)
              setTimeout(() => deleteCctvMedia(mediaId, retryCount + 1), RETRY_DELAY)
              return
            }
          }

          throw fetchError
        }
      } catch (e) {
        console.error('Error deleting CCTV media:', e)

        let errorMessage = 'เกิดข้อผิดพลาดในการลบไฟล์'

        if (e instanceof Error) {
          if (e.message.includes('timeout') || e.message.includes('AbortError')) {
            errorMessage = 'การลบไฟล์ใช้เวลานานเกินไป กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
          } else if (e.message.includes('network') || e.message.includes('fetch')) {
            errorMessage = 'เกิดปัญหาการเชื่อมต่อเครือข่าย กรุณาลองใหม่อีกครั้ง'
          } else if (e.message.includes('HTTP')) {
            errorMessage = 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
          } else {
            errorMessage = e.message
          }

          console.error('Delete error details:', {
            message: e.message,
            stack: e.stack,
            mediaId,
            reportId: report.report_id,
            retryCount,
            maxRetries: MAX_RETRIES,
          })
        }

        toast.error(errorMessage)
      }
    },
    [report, cctvMedia, setCctvMedia]
  )

  const toggleCctvPublish = useCallback(
    async (mediaId: string, next: boolean) => {
      if (!report) return
      try {
        const res = await fetch(`/api/reports/${report.report_id}/photos?mediaId=${mediaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: next }),
        })
        const data = await res.json()
        if (data.success) {
          setCctvMedia(prev => prev.map(m => m.id === mediaId
            ? { ...m, published: String(next), approval_status: next ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน' }
            : m))
          toast.success(next ? 'ตั้งค่าเป็นพร้อมใช้งาน' : 'ตั้งค่าเป็นไม่พร้อมใช้งาน')
        } else {
          toast.error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ')
        }
      } catch (e) {
        console.error(e)
        toast.error('เปลี่ยนสถานะไม่สำเร็จ')
      }
    },
    [report, setCctvMedia]
  )

  return { cctvUpload, deleteCctvMedia, toggleCctvPublish }
}
