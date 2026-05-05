'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Attachment, Category, Media, Officer, Report } from '../_types'

type ValidationField = 'officer_decision' | 'internal_notes'

export interface UseReportDataReturn {
  loading: boolean
  saving: boolean
  report: Report | null
  officers: Officer[]
  categories: Category[]
  attachments: Attachment[]
  cctvMedia: Media[]
  form: Partial<Report>
  validationErrors: Record<string, string>
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
  setCctvMedia: React.Dispatch<React.SetStateAction<Media[]>>
  update: (patch: Partial<Report>) => void
  validateField: (
    fieldName: ValidationField,
    value: string | null | undefined,
    additionalData?: { officer_decision?: string | null; internal_notes?: string | null }
  ) => boolean
  saveAll: () => Promise<void>
}

export function useReportData(id: string | undefined): UseReportDataReturn {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [report, setReport] = useState<Report | null>(null)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [cctvMedia, setCctvMedia] = useState<Media[]>([])

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const validationErrorsRef = useRef(validationErrors)
  useEffect(() => {
    validationErrorsRef.current = validationErrors
  }, [validationErrors])

  const [form, setForm] = useState<Partial<Report>>({})
  const update = useCallback((patch: Partial<Report>) => setForm(prev => ({ ...prev, ...patch })), [])

  const validateField = useCallback(
    (
      fieldName: ValidationField,
      value: string | null | undefined,
      additionalData?: { officer_decision?: string | null; internal_notes?: string | null }
    ) => {
      const errors = { ...validationErrorsRef.current }

      if (fieldName === 'officer_decision') {
        if (value === 'ไม่อนุญาต') {
          if (!additionalData?.internal_notes || additionalData.internal_notes.trim() === '') {
            errors.internal_notes = 'กรุณาระบุรายละเอียดการปฏิบัติเมื่อเลือก "ไม่อนุญาต"'
          } else {
            delete errors.internal_notes
          }
        } else {
          delete errors.internal_notes
        }
      }

      if (fieldName === 'internal_notes') {
        if (additionalData?.officer_decision === 'ไม่อนุญาต' && (!value || value.trim() === '')) {
          errors.internal_notes = 'กรุณาระบุรายละเอียดการปฏิบัติเมื่อเลือก "ไม่อนุญาต"'
        } else {
          delete errors.internal_notes
        }
      }

      setValidationErrors(errors)
      return Object.keys(errors).length === 0
    },
    []
  )

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function loadAll() {
      try {
        setLoading(true)
        const [rRes, oRes, cRes, aRes, pRes] = await Promise.all([
          fetch(`/api/reports/${id}`),
          fetch('/api/officers'),
          fetch('/api/categories'),
          fetch(`/api/reports/${id}/attachments`),
          fetch(`/api/reports/${id}/photos`),
        ])

        const r = await rRes.json()
        const o = await oRes.json().catch(() => ({ data: [] }))
        const c = await cRes.json().catch(() => ({ data: [] }))
        const a = await aRes.json().catch(() => ({ data: [] }))
        const p = await pRes.json().catch(() => ({ data: [] }))

        if (cancelled) return
        if (!r.success) {
          toast.error(r.message || 'ไม่พบข้อมูลคำร้อง')
          router.push('/admin/request')
          return
        }

        const reportData = r.data as Report
        if (reportData.latitude !== null && reportData.latitude !== undefined) {
          reportData.latitude = Number(reportData.latitude)
        }
        if (reportData.longitude !== null && reportData.longitude !== undefined) {
          reportData.longitude = Number(reportData.longitude)
        }
        setReport(reportData)
        setOfficers(o.data || [])
        setCategories((c.data || []).map((cat: { id: string; name: string }) => ({
          category_id: cat.id,
          category_name: cat.name,
        })))
        setAttachments((a.data || []).map((x: Attachment) => x))
        setCctvMedia((p.data || []).map((m: Media) => m))
      } catch (e) {
        console.error(e)
        toast.error('โหลดข้อมูลไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [id, router])

  useEffect(() => {
    if (report) {
      setForm(report)
      validateField('officer_decision', report.officer_decision, report)
      validateField('internal_notes', report.internal_notes, report)
    }
  }, [report, validateField])

  const saveAll = useCallback(async () => {
    if (!report) return

    const isValid = validateField('officer_decision', form.officer_decision, form) &&
                    validateField('internal_notes', form.internal_notes, form)

    if (!isValid) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/reports/${report.report_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('บันทึกข้อมูลเรียบร้อย')
        const updatedData = { ...data.data }
        if (updatedData.latitude !== null && updatedData.latitude !== undefined) {
          updatedData.latitude = Number(updatedData.latitude)
        }
        if (updatedData.longitude !== null && updatedData.longitude !== undefined) {
          updatedData.longitude = Number(updatedData.longitude)
        }
        setReport(updatedData as Report)
        setForm(prev => ({ ...prev, ...updatedData }))
        setValidationErrors({})
      } else {
        toast.error(data.message || 'บันทึกไม่สำเร็จ')
      }
    } catch (e) {
      console.error(e)
      toast.error('เกิดข้อผิดพลาดระหว่างบันทึก')
    } finally {
      setSaving(false)
    }
  }, [report, form, validateField])

  return {
    loading,
    saving,
    report,
    officers,
    categories,
    attachments,
    cctvMedia,
    form,
    validationErrors,
    setAttachments,
    setCctvMedia,
    update,
    validateField,
    saveAll,
  }
}
