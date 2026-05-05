'use client'

import React from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Image as ImageIcon, Paperclip, Shield, User } from 'lucide-react'

const TRIGGER_BASE = 'rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)]'

const TABS: Array<{ value: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'applicant', label: 'ข้อมูลผู้ยื่น', Icon: User },
  { value: 'officer', label: 'เจ้าหน้าที่ดำเนินการ', Icon: Shield },
  { value: 'docs', label: 'แนบเอกสาร', Icon: Paperclip },
  { value: 'photos', label: 'อัปโหลดภาพจาก CCTV', Icon: ImageIcon },
]

export function EditTabsList() {
  return (
    <div className="px-1">
      <div className="md:hidden overflow-x-auto scrollbar-hide smooth-scroll">
        <TabsList className="inline-flex min-w-max gap-1 bg-transparent p-0 border-b border-[var(--border)] px-1">
          {TABS.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className={`${TRIGGER_BASE} whitespace-nowrap`}>
              <Icon className="h-4 w-4 mr-2" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="hidden md:block">
        <TabsList className="w-full justify-start gap-1 bg-transparent p-0 border-b border-[var(--border)]">
          {TABS.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className={TRIGGER_BASE}>
              <Icon className="h-4 w-4 mr-2" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  )
}
