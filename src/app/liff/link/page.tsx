'use client'

import { Suspense } from 'react'
import { LiffLinkContent } from './components/LiffLinkContent'

export default function LiffLinkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <LiffLinkContent />
    </Suspense>
  )
}