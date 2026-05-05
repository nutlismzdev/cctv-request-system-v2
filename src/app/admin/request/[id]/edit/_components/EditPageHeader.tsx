'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatThaiDateBE, getLocalizedPrefix, STATUS_TONE } from '../_utils'
import type { Report } from '../_types'

interface EditPageHeaderProps {
  report: Report
  saving: boolean
  onSave: () => void
}

export function EditPageHeader({ report, saving, onSave }: EditPageHeaderProps) {
  const router = useRouter()
  const tone = STATUS_TONE[report.status] || STATUS_TONE['รอดำเนินการ']
  const displayName = `${getLocalizedPrefix(report.prefix ?? '', report.language)} ${report.full_name ?? ''}`.trim() || '-'

  return (
    <>
      <div className="w-full border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/80">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10" onClick={() => router.push('/admin/request')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับรายการ
          </Button>

          <div className="text-[var(--foreground)] text-sm md:text-base ml-1 md:ml-2">
            <span className="font-semibold">แก้ไขคำร้อง</span> • #{report.report_id} — {displayName}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => router.push(`/api/reports/${report.report_id}/pdf?mode=draw`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              ดู PDF
            </Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="h-10 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]"
            >
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              บันทึกทั้งหมด
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
              <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
              <span className="text-[var(--foreground)]">สถานะ:</span>
              <span className={tone.text}>
                {report.status === 'เอกสารอนุมัติเรียบร้อย' ? 'อนุมัติแล้ว' : report.status}
              </span>
            </div>
            <div className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
              ยื่นคำร้องเมื่อ <span className="font-medium text-[var(--foreground)]">{formatThaiDateBE(report.submitted_at)}</span>
            </div>
            {report.updated_at && (
              <div className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
                อัปเดตล่าสุด <span className="font-medium text-[var(--foreground)]">{formatThaiDateBE(report.updated_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
