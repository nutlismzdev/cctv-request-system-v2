'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@/components/ui/tabs'
import { Download, HardDrive, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react'
import { SectionCard } from './_shared'
import { humanSize, downloadFile } from '@/lib/upload-utils'
import { formatThaiDateBE, isOperationImage } from '../_utils'
import type { Attachment, AttachmentCategory } from '../_types'

interface DocsTabProps {
  attachments: Attachment[]
  uploadDocsWithCategory: (kind: AttachmentCategory) => (files: FileList) => void
  deleteAttachment: (attId: string | number) => void
  openServerBrowser: (category: 'idcopy' | 'operation') => void
}

export function DocsTab({ attachments, uploadDocsWithCategory, deleteAttachment, openServerBrowser }: DocsTabProps) {
  return (
    <TabsContent value="docs" className="space-y-4">
      <SectionCard
        title="สำเนาบัตรประชาชน / สำเนาใบบันทึกประจำวัน"
        icon={<Paperclip className="h-4 w-4" />}
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openServerBrowser('idcopy')}
              className="h-9"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Browse Server
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadDocsWithCategory('idcopy')(e.target.files!)
                  e.target.value = ''
                }}
                accept=".pdf,.png,.jpg,.jpeg,.heic"
              />
              <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer h-9">
                <Upload className="h-4 w-4 mr-2" /> เลือกไฟล์
              </span>
            </label>
          </div>
        }
      >
        <label className="mt-1 block w-full rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              uploadDocsWithCategory('idcopy')(e.target.files!)
              e.target.value = ''
            }}
            accept=".pdf,.png,.jpg,.jpeg,.heic"
          />
          <div className="text-sm text-slate-600">
            ลากไฟล์มาวางที่นี่ หรือ <span className="text-[var(--primary)] underline">คลิกเพื่อเลือกไฟล์</span>
          </div>
        </label>
      </SectionCard>

      <SectionCard
        title="ภาพระหว่างปฏิบัติการ"
        icon={<ImageIcon className="h-4 w-4" />}
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openServerBrowser('operation')}
              className="h-9"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Browse Server
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                multiple
                accept="image/*,.heic"
                className="hidden"
                onChange={(e) => {
                  uploadDocsWithCategory('operation')(e.target.files!)
                  e.target.value = ''
                }}
              />
              <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer h-9">
                <Upload className="h-4 w-4 mr-2" /> อัปโหลดรูปภาพ
              </span>
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {attachments.filter(a => isOperationImage(a.category, a.file_name)).length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-6">ยังไม่มีรูปภาพ</div>
          ) : (
            attachments
              .filter(a => isOperationImage(a.category, a.file_name))
              .map((f) => (
                <div key={f.id} className="relative border rounded-lg overflow-hidden bg-white group">
                  <Image
                    src={f.url}
                    alt={f.file_name}
                    width={300}
                    height={128}
                    className="w-full h-32 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-xs px-2 py-1 truncate">
                    {f.file_name}
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => downloadFile(f.url, f.file_name)}
                      className="rounded-md border bg-white/90 p-1 text-[var(--primary)] hover:bg-blue-50"
                      aria-label="ดาวน์โหลดรูปภาพ"
                      title="ดาวน์โหลด"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAttachment(f.id)}
                      className="rounded-md border bg-white/90 p-1 text-rose-600 hover:bg-rose-50"
                      aria-label="ลบรูปภาพ"
                      title="ลบ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="เอกสารแนบทั้งหมด">
        <div className="overflow-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 border-b">ไฟล์</th>
                <th className="text-left px-3 py-2 border-b">ประเภทไฟล์</th>
                <th className="text-left px-3 py-2 border-b">หมวด</th>
                <th className="text-left px-3 py-2 border-b">ขนาด</th>
                <th className="text-left px-3 py-2 border-b">อัปโหลดเมื่อ</th>
                <th className="text-center px-3 py-2 border-b">ดาวน์โหลด</th>
                <th className="text-center px-3 py-2 border-b">ลบ</th>
              </tr>
            </thead>
            <tbody>
              {attachments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-6">ยังไม่มีเอกสารแนบ</td>
                </tr>
              ) : (
                attachments.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border-b">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">{f.file_name}</a>
                    </td>
                    <td className="px-3 py-2 border-b">{f.file_type}</td>
                    <td className="px-3 py-2 border-b">
                      <Badge variant="outline" className="bg-slate-50">
                        {f.category === 'idcopy' && 'สำเนาบัตร/บันทึกประจำวัน'}
                        {f.category === 'operation' && 'ภาพระหว่างปฏิบัติการ'}
                        {!f.category && 'ไม่ระบุ'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 border-b">{humanSize(f.file_size)}</td>
                    <td className="px-3 py-2 border-b">{formatThaiDateBE(f.uploaded_at)}</td>
                    <td className="px-3 py-2 border-b text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[var(--primary)] hover:text-[var(--primary)] hover:bg-blue-50 border-blue-200"
                        onClick={() => downloadFile(f.url, f.file_name)}
                        title="ดาวน์โหลด"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="px-3 py-2 border-b text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => deleteAttachment(f.id)}
                        title="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </TabsContent>
  )
}
