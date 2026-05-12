// src/components/request-loading-skeleton.tsx
'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  isDesktop: boolean
  /** ถ้าอยากให้ progress ของ stepper สมจริง ส่งค่า step ปัจจุบันเข้ามา (0..2) */
  activeStep?: number
}

const STEPS = 3

const RequestLoadingSkeleton = React.memo(function RequestLoadingSkeleton({
  isDesktop,
  activeStep = 0,
}: Props) {
  // width ของ progress bar บนเดสก์ท็อป
  const pct = Math.max(0, Math.min(100, (activeStep / (STEPS - 1)) * 100))

  if (isDesktop) {
    return (
      <div
        className="min-h-screen bg-gray-50"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {/* Hero (ใช้คลาสเดียวกับเพจจริง) */}
        <section
          className="relative overflow-hidden bg-gradient-to-br from-[var(--primary)] to-[#001a4d] pt-20"
          style={{
            backgroundImage: 'url("/hero/hero.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay',
          }}
          aria-hidden
        >
          <div className="relative max-w-6xl mx-auto px-6 sm:px-8 py-8 sm:py-12">
            <Skeleton className="h-6 w-36 rounded" />
            <Skeleton className="mt-4 h-10 w-[28rem] max-w-full rounded" />
            <Skeleton className="mt-3 h-5 w-[22rem] max-w-full rounded" />
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-5 w-28 rounded" />
            </div>
          </div>
        </section>

        {/* Main */}
        <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          {/* Stepper (เดสก์ท็อป) */}
          <div className="sticky top-24 z-40 bg-gray-50 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="relative w-full max-w-[720px]">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 hidden sm:block h-2 rounded-full bg-muted" />
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 hidden sm:block h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
                <ol className="relative z-10 hidden sm:flex sm:justify-between gap-2">
                  {Array.from({ length: STEPS }).map((_, i) => (
                    <li key={i} className="flex-1 flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-5 w-28 rounded" />
                    </li>
                  ))}
                </ol>
                {/* mobile label ของ step ปัจจุบัน */}
                <div className="block sm:hidden space-y-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ความครบถ้วน (เดสก์ท็อป) */}
              <div className="hidden md:flex items-center gap-3 min-w-[280px]">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </div>
            </div>
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left: เนื้อหา (สองการ์ดแรกเหมือนหน้า Applicant & Address) */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Card: ข้อมูลผู้ยื่นคำร้อง */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-7 w-56 rounded" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-72 rounded" />
                </CardHeader>
                <CardContent className="space-y-4 py-7">
                  {/* grid เหมือนจริง: 1 / 2 / 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* คำนำหน้า (Select h-12) */}
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24 rounded" />
                      <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                    {/* ชื่อ-นามสกุล */}
                    <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                      <Skeleton className="h-5 w-32 rounded" />
                      <div className="relative">
                        <Skeleton className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full" />
                        <Skeleton className="h-12 w-full rounded-md pl-10" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* โทรศัพท์ */}
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-28 rounded" />
                      <div className="relative">
                        <Skeleton className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full" />
                        <Skeleton className="h-12 w-full rounded-md pl-10" />
                      </div>
                    </div>
                    {/* เลขบัตร/พาสปอร์ต */}
                    <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                      <Skeleton className="h-5 w-60 rounded" />
                      <div className="relative">
                        <Skeleton className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full" />
                        <Skeleton className="h-12 w-full rounded-md pl-10" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card: ที่อยู่ผู้ยื่นคำร้อง */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-7 w-56 rounded" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-72 rounded" />
                </CardHeader>
                <CardContent className="space-y-4 py-7">
                  {/* แถวแรก (บ้านเลขที่/หมู่/ซอย/ถนน) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-5 w-28 rounded" />
                        <Skeleton className="h-12 w-full rounded-md" />
                      </div>
                    ))}
                  </div>

                  {/* แถวจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ (Combobox + Input) */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`geo-${i}`} className="space-y-2">
                        <Skeleton className="h-5 w-24 rounded" />
                        {/* ปุ่ม combobox (h-12) */}
                        <Skeleton className="h-12 w-full rounded-md" />
                      </div>
                    ))}
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-28 rounded" />
                      <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Summary & Actions */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-48 rounded" />
                  <Skeleton className="h-4 w-60 rounded mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Mobile skeleton
  return (
    <div
      className="min-h-screen bg-gray-50"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <section
        className="relative bg-gradient-to-br from-[var(--primary)] to-[#001a4d] pt-20"
        style={{
          backgroundImage: 'url("/hero/hero.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay',
        }}
        aria-hidden
      >
        <div className="px-4 sm:px-5 py-6 sm:py-8">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="mt-3 h-6 w-56 rounded" />
          <Skeleton className="mt-2 h-4 w-48 rounded" />
          <div className="mt-5">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </section>

      <main className="px-4 py-6 space-y-6 pb-20">
        {/* Applicant Card */}
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-44 rounded" />
            <Skeleton className="h-4 w-56 rounded mt-2" />
          </CardHeader>
          <CardContent className="space-y-4 py-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                <Skeleton className="h-5 w-60 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Card */}
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-44 rounded" />
            <Skeleton className="h-4 w-56 rounded mt-2" />
          </CardHeader>
          <CardContent className="space-y-4 py-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))}
              <div className="space-y-2">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sticky buttons */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>
      </main>
    </div>
  )
})

export default RequestLoadingSkeleton
