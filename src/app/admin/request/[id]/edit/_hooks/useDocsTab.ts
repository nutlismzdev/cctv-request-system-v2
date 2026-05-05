'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useUpload } from '@/lib/use-upload'
import type { Attachment, AttachmentCategory, Report, UploadResponse } from '../_types'

interface UseDocsTabArgs {
  report: Report | null
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
}

export function useDocsTab({ report, setAttachments }: UseDocsTabArgs) {
  const docsUpload = useUpload({
    endpoint: `/api/reports/${report?.report_id}/attachments`,
    withCompression: true,
    onSuccess: (data) => {
      const response = data as UploadResponse
      const added: Attachment[] = (response.data || []).map((x: unknown) => ({
        ...(x as Attachment),
        category: (x as Attachment).category ?? 'เอกสารอื่นๆ',
      }))
      setAttachments(prev => [...added, ...prev])
    },
  })

  const uploadDocsWithCategory = useCallback(
    (kind: AttachmentCategory) => (files: FileList) => {
      if (!report || !files || !files.length) return
      docsUpload.upload(files, false, { category: kind })
    },
    [report, docsUpload]
  )

  const deleteAttachment = useCallback(
    async (attId: string | number) => {
      if (!report) return
      if (!confirm('ต้องการลบเอกสารนี้หรือไม่')) return
      try {
        const attachmentId = String(attId)
        const res = await fetch(`/api/reports/${report.report_id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) {
          setAttachments(prev => prev.filter(x => String(x.id) !== attachmentId))
          toast.success('ลบเอกสารแล้ว')
        } else {
          toast.error(data.message || 'ลบไม่สำเร็จ')
        }
      } catch (e) {
        console.error(e)
        toast.error('ลบไม่สำเร็จ')
      }
    },
    [report, setAttachments]
  )

  const reloadAttachments = useCallback(async () => {
    if (!report) return
    try {
      const aRes = await fetch(`/api/reports/${report.report_id}/attachments`)
      const a = await aRes.json().catch(() => ({ data: [] }))
      setAttachments((a.data || []).map((x: Attachment) => x))
      toast.success('โหลดเอกสารใหม่สำเร็จ')
    } catch (e) {
      console.error(e)
      toast.error('โหลดเอกสารไม่สำเร็จ')
    }
  }, [report, setAttachments])

  return { uploadDocsWithCategory, deleteAttachment, reloadAttachments }
}
