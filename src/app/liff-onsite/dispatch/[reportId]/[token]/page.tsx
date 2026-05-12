'use client'

/**
 * Path-based dispatch — redirect ทันทีไปที่ /dispatch?reportId=&token=
 * ห้าม init LIFF SDK ที่ path ลึก เพราะจะ trigger OAuth round-trip ใหม่ → loop
 * (การ init ทั้งหมดทำที่ /liff-onsite/dispatch หน้าตรง ๆ ตาม Endpoint URL)
 */

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LiffPathDispatchPage() {
  const params = useParams() as { reportId?: string; token?: string }
  const reportId = params.reportId || ''
  const token = params.token || ''

  useEffect(() => {
    if (!reportId || !token) return
    const dest = `/liff-onsite/dispatch?reportId=${encodeURIComponent(reportId)}&token=${encodeURIComponent(token)}`
    window.location.replace(dest)
  }, [reportId, token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
    </div>
  )
}
