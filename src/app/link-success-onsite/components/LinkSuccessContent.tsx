'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import type { LiffSDK } from '@/types/liff'

export function LinkSuccessContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [countdown, setCountdown] = useState(5)
  const liffRef = useRef<LiffSDK | null>(null)

  // Initialize LIFF SDK on mount (needed for closeWindow)
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (typeof window === 'undefined') return
        const liff = window.liff
        if (!liff) return

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) return

        await liff.init({ liffId })
        liffRef.current = liff
      } catch {
        // LIFF SDK not available — ไม่ใช่ error เพราะอาจเปิดจาก browser ปกติ
      }
    }
    initLiff()
  }, [])

  // Countdown timer
  useEffect(() => {
    if ((status === 'linked' || status === 'already_linked') && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown, status])

  const handleClose = useCallback(() => {
    if (typeof window === 'undefined') return

    // 1) ใช้ LIFF SDK ปิด in-app browser (วิธีที่ถูกต้องสำหรับ LINE)
    const liff = liffRef.current
    if (liff) {
      try {
        if (liff.isInClient?.()) {
          liff.closeWindow()
          return
        }
      } catch { /* LIFF not ready */ }
    }

    // 2) Fallback: ลองปิด window
    try {
      window.close()
    } catch { /* blocked by browser */ }

    // 3) Fallback สุดท้าย: กลับไปที่ LINE app
    setTimeout(() => {
      if (!window.closed) {
        window.location.href = 'https://line.me/R/'
      }
    }, 300)
  }, [])

  // Auto-close เมื่อ countdown ถึง 0
  useEffect(() => {
    if (countdown === 0 && (status === 'linked' || status === 'already_linked')) {
      handleClose()
    }
  }, [countdown, status, handleClose])

  return (
    <div className={`min-h-screen ${THEME_COLORS.background} p-4`}>
      <div className="max-w-md mx-auto pt-20">
        <Card>
          <CardContent className="p-6 text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />

            <div>
              <h1 className="text-2xl font-bold text-green-800 mb-2">
                {status === 'already_linked' ? 'คำร้องนี้เชื่อมต่อแล้ว' : 'เชื่อมต่อสำเร็จ!'}
              </h1>
              <p className="text-gray-600">
                {status === 'already_linked'
                  ? `คำร้องของคุณ ได้ถูกเชื่อมโยงกับ LINE ของคุณอยู่แล้ว`
                  : `คำร้องของคุณ ได้ถูกเชื่อมโยงกับ LINE ของคุณเรียบร้อยแล้ว`}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">คุณจะได้รับแจ้งเตือนเมื่อ:</h3>
              <ul className="text-sm text-green-700 space-y-1 text-left">
                <li>• สถานะคำร้องมีการเปลี่ยนแปลง</li>
                <li>• เอกสารพร้อมให้ดาวน์โหลด</li>
              
              </ul>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">LINE OA จะส่งข้อความยืนยัน</span>
              </div>
              <p className="text-sm text-blue-700">
                ตรวจสอบข้อความใน LINE Official Account ของเรา
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                ปิดหน้านี้
              </Button>

              {countdown > 0 && (
                <p className="text-sm text-gray-500">หน้านี้จะปิดอัตโนมัติใน {countdown} วินาที</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-xs text-gray-500">
          <p>CCTV เทศบาลนครหัวหิน</p>
          <p>ระบบจัดการคำร้องขอดูภาพ</p>
        </div>
      </div>
    </div>
  )
}

