'use client'

import React from 'react'
import { Label } from '@/components/ui/label'

export function SectionCard({
  title,
  icon,
  children,
  right,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--card)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)] rounded-t-lg">
        <div className="flex items-center gap-2 text-[var(--foreground)] font-semibold">
          {icon}
          <span className="tracking-tight">{title}</span>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export const L = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-[13px] font-medium text-[var(--muted-foreground)]">{children}</Label>
)
