'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TabsContent } from '@/components/ui/tabs'
import { Shield } from 'lucide-react'
import { SectionCard, L } from './_shared'
import type { Officer, Report } from '../_types'

interface OfficerTabProps {
  form: Partial<Report>
  officers: Officer[]
  validationErrors: Record<string, string>
  update: (patch: Partial<Report>) => void
  validateField: (
    fieldName: 'officer_decision' | 'internal_notes',
    value: string | null | undefined,
    additionalData?: { officer_decision?: string | null; internal_notes?: string | null }
  ) => boolean
}

export function OfficerTab({ form, officers, validationErrors, update, validateField }: OfficerTabProps) {
  return (
    <TabsContent value="officer">
      <SectionCard title="เจ้าหน้าที่ดำเนินการ" icon={<Shield className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <L>เลือกเจ้าหน้าที่ผู้รับผิดชอบ</L>
            <Select
              value={String(form.assigned_officer_id ?? '')}
              onValueChange={(v) => update({ assigned_officer_id: Number(v) })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="เลือกเจ้าหน้าที่" />
              </SelectTrigger>
              <SelectContent>
                {officers.map(o => (
                  <SelectItem key={o.officer_id} value={String(o.officer_id)}>
                    {o.full_name}{o.position ? ` (${o.position})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <L>ความคิดเห็นเจ้าหน้าที่</L>
            <Select
              value={form.officer_decision || ''}
              onValueChange={(v) => {
                update({ officer_decision: v })
                validateField('officer_decision', v, { ...form, officer_decision: v })
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="เลือกการพิจารณา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="อนุญาต">อนุญาต</SelectItem>
                <SelectItem value="ไม่อนุญาต">ไม่อนุญาต</SelectItem>
                <SelectItem value="รอพิจารณา">รอพิจารณา</SelectItem>
                <SelectItem value="ต้องการข้อมูลเพิ่มเติม">ต้องการข้อมูลเพิ่มเติม</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4">
            <L>รายละเอียดการปฏิบัติ</L>
            <Textarea
              className={`min-h-[120px] ${validationErrors.internal_notes ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder=""
              value={form.internal_notes || ''}
              onChange={(e) => {
                const value = e.target.value
                update({ internal_notes: value })
                validateField('internal_notes', value, { ...form, internal_notes: value })
              }}
            />
            <p className="text-xs text-slate-500 mt-1">กรณีไม่อนุญาติ ระบุเหตุผลในช่องนี้</p>
            {validationErrors.internal_notes && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.internal_notes}</p>
            )}
          </div>
        </div>
      </SectionCard>
    </TabsContent>
  )
}
