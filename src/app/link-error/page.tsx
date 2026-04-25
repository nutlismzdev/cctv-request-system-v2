import { Suspense } from 'react'
import { LinkErrorContent } from './components/LinkErrorContent'

export default function LinkErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <LinkErrorContent />
    </Suspense>
  )
}
