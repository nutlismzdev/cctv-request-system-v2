import { Suspense } from 'react'
import { LinkSuccessContent } from './components/LinkSuccessContent'

export default function LinkSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <LinkSuccessContent />
    </Suspense>
  )
}
