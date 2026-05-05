'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { CheckCircle2, MapPin, User, XCircle } from 'lucide-react'
import { LocationPicker } from '@/components/location-picker'
import { SectionCard, L } from './_shared'
import { getLocalizedPrefix } from '../_utils'
import type { Category, Report } from '../_types'

interface ApplicantTabProps {
  report: Report
  form: Partial<Report>
  categories: Category[]
  update: (patch: Partial<Report>) => void
}

export function ApplicantTab({ report, form, categories, update }: ApplicantTabProps) {
  return (
    <TabsContent value="applicant" className="space-y-4">
      <SectionCard title="ข้อมูลส่วนบุคคล" icon={<User className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <L>คำนำหน้า</L>
            <Input className="h-11" value={form.prefix || ''} onChange={(e) => update({ prefix: e.target.value })} />
            {report.language === 'en' && (
              <div className="text-sm text-muted-foreground mt-1">
                แสดงเป็น: {getLocalizedPrefix(form.prefix || '', report.language)}
              </div>
            )}
          </div>
          <div>
            <L>ชื่อ-นามสกุล</L>
            <Input className="h-11" value={form.full_name || ''} onChange={(e) => update({ full_name: e.target.value })} />
          </div>
          <div>
            <L>อายุ</L>
            <Input
              className="h-11"
              type="number"
              value={form.age || ''}
              onChange={(e) => update({ age: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="ปี"
            />
          </div>
          <div>
            <L>เลขบัตรประชาชน / Passport</L>
            <Input className="h-11" value={form.id_or_passport_number || ''} onChange={(e) => update({ id_or_passport_number: e.target.value })} />
          </div>
          <div>
            <L>เบอร์ติดต่อ</L>
            <Input className="h-11" value={form.phone_number || ''} onChange={(e) => update({ phone_number: e.target.value })} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="ที่อยู่ตามติดต่อ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <L>บ้านเลขที่</L>
            <Input className="h-11" value={form.house_number || ''} onChange={(e) => update({ house_number: e.target.value })} />
          </div>
          <div>
            <L>หมู่ที่</L>
            <Input className="h-11" value={form.village_number || ''} onChange={(e) => update({ village_number: e.target.value })} />
          </div>
          <div>
            <L>ตรอก/ซอย</L>
            <Input className="h-11" value={form.alley || ''} onChange={(e) => update({ alley: e.target.value })} />
          </div>
          <div>
            <L>ถนน</L>
            <Input className="h-11" value={form.road || ''} onChange={(e) => update({ road: e.target.value })} />
          </div>
          <div>
            <L>ตำบล/แขวง</L>
            <Input className="h-11" value={form.sub_district || ''} onChange={(e) => update({ sub_district: e.target.value })} />
          </div>
          <div>
            <L>อำเภอ/เขต</L>
            <Input className="h-11" value={form.district || ''} onChange={(e) => update({ district: e.target.value })} />
          </div>
          <div>
            <L>จังหวัด</L>
            <Input className="h-11" value={form.province || ''} onChange={(e) => update({ province: e.target.value })} />
          </div>
          <div>
            <L>รหัสไปรษณีย์</L>
            <Input className="h-11" value={form.postal_code || ''} onChange={(e) => update({ postal_code: e.target.value })} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="รายละเอียดคำร้อง / เหตุการณ์">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <L>หมวดหมู่</L>
            <Select
              value={String(form.category_id || '')}
              onValueChange={(v) => update({ category_id: Number(v) })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <SelectItem value="" disabled>
                    ไม่พบข้อมูลหมวดหมู่
                  </SelectItem>
                ) : (
                  categories.map((c, index) => (
                    <SelectItem key={`category-${c.category_id}-${index}`} value={String(c.category_id)}>
                      {c.category_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <L>ประเภทคำร้อง</L>
            <Input className="h-11" value={form.request_type || ''} onChange={(e) => update({ request_type: e.target.value })} />
          </div>

          <div className="md:col-span-2">
            <L>สถานะการเกี่ยวข้อง</L>
            <Select
              value={form.involvement_role || ''}
              onValueChange={(v) => update({ involvement_role: v })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="เลือกสถานะการเกี่ยวข้อง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ผู้เสียหาย">ผู้เสียหาย</SelectItem>
                <SelectItem value="ญาติ">ญาติ</SelectItem>
                <SelectItem value="ผู้เกี่ยวข้อง">ผู้เกี่ยวข้อง</SelectItem>
                <SelectItem value="เจ้าหน้าที่รัฐ">เจ้าหน้าที่รัฐ</SelectItem>
                <SelectItem value="ประกัน">ประกัน</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(form.involvement_role === 'ญาติ' || form.involvement_role === 'ผู้เกี่ยวข้อง') && (
            <div className="md:col-span-2">
              <L>ระบุความเกี่ยวข้อง</L>
              <Input
                className="h-11"
                value={form.involvement_explain || ''}
                onChange={(e) => update({ involvement_explain: e.target.value })}
                placeholder="เช่น บิดา/มารดา/เพื่อนร่วมงาน/ผู้ดูแล ฯลฯ"
              />
            </div>
          )}

          <div>
            <L>วันที่เกิดเหตุ</L>
            <Input type="date" className="h-11" value={form.incident_date ?? ''} onChange={(e) => update({ incident_date: e.target.value })} />
          </div>
          <div>
            <L>เวลาที่เกิดเหตุ</L>
            <Input type="time" className="h-11" value={form.incident_time ?? ''} onChange={(e) => update({ incident_time: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <L>สถานที่เกิดเหตุ</L>
            <Input className="h-11" value={form.incident_location || ''} onChange={(e) => update({ incident_location: e.target.value })} />
          </div>

          <div className="md:col-span-4">
            <L>รายละเอียดเพิ่มเติม</L>
            <Textarea
              className="min-h-[120px]"
              value={form.request_details || ''}
              onChange={(e) => update({ request_details: e.target.value })}
              placeholder="กรุณาระบุรายละเอียดเพิ่มเติมของเหตุการณ์..."
            />
          </div>

          <div className="md:col-span-4">
            <L>เอกสารหลักฐานประกอบ</L>
            <div className="bg-gray-50 border rounded-md p-4 space-y-3">
              {(() => {
                try {
                  const docs = form.supporting_documents ? JSON.parse(form.supporting_documents) : null
                  if (!docs) {
                    return <div className="text-gray-500 text-sm">ไม่มีข้อมูลเอกสาร</div>
                  }
                  const docList: string[] = []
                  if (docs.id_card_copy) docList.push('สำเนาบัตรประจำตัวประชาชน/บัตรประจำตัวเจ้าหน้าที่ของรัฐ')
                  if (docs.police_report_copy) docList.push('สำเนาบันทึกการแจ้งความ')
                  if (docs.other) docList.push(`อื่นๆ: ${docs.other_details || 'ไม่ได้ระบุ'}`)

                  return docList.length > 0 ? (
                    <ul className="space-y-1">
                      {docList.map((doc, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-500 text-sm">ไม่ได้เลือกเอกสาร</div>
                  )
                } catch {
                  return <div className="text-gray-500 text-sm">ข้อมูลเอกสารไม่ถูกต้อง</div>
                }
              })()}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="พิกัดที่เกิดเหตุ" icon={<MapPin className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            คลิกบนแผนที่เพื่อปักหมุดตำแหน่งที่เกิดเหตุ หรือใช้ปุ่ม &quot;ใช้ตำแหน่งปัจจุบัน&quot; เพื่อระบุพิกัดอัตโนมัติ
          </div>
          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onLocationSelect={(lat, lng) => {
              update({ latitude: lat, longitude: lng })
            }}
            height="350px"
          />
          {form.latitude && form.longitude && (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md">
              <div className="text-sm">
                <span className="text-slate-500">พิกัดที่เลือก: </span>
                <span className="font-mono font-medium">
                  {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  update({ latitude: null, longitude: null })
                }}
                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                ล้างพิกัด
              </Button>
            </div>
          )}
        </div>
      </SectionCard>
    </TabsContent>
  )
}
