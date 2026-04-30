'use client'

/**
 * OAuth callback — redirect กลับไปที่ /dispatch
 * (เผื่อกรณี link เก่าที่ยังชี้มาที่นี่)
 */

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function LiffOAuthCallbackPage() {
  useEffect(() => {
    window.location.replace('/liff-onsite/dispatch')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  )
}
