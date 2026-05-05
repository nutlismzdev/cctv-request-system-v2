'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function EditPageSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-white/90">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}
