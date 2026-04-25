// src/app/link-error/components/LinkErrorContent.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'

export function LinkErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const getErrorMessage = (err: string | null) => {
    switch (err) {
      case 'invalid_params':
        return 'ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
      case 'report_not_found':
        return 'ไม่พบคำร้องที่ตรงกับรหัสเชื่อมต่อ หรือคำร้องอาจถูกเชื่อมโยงแล้ว'
      case 'already_linked_to_other':
        return 'คำร้องนี้ถูกเชื่อมโยงกับบัญชี LINE อื่นแล้ว'
      case 'code_used':
        return 'รหัสดังกล่าวถูกใช้ไปแล้ว'
      case 'code_expired':
        return 'รหัสดังกล่าวหมดอายุแล้ว'
      case 'invalid_status':
        return 'สถานะคำร้องไม่อนุญาตให้เชื่อมโยง'
      case 'server_error':
        return 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
      default:
        return 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง'
    }
  }

  const handleRetry = () => {
    window.history.back()
  }

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      const { parent } = window
      if (parent && typeof parent.postMessage === 'function') {
        parent.postMessage({ type: 'liff-close' }, '*')
      }
    }
    window.close()
  }

  return (
    <div className={`min-h-screen ${THEME_COLORS.background} p-4`}>
      <div className="max-w-md mx-auto pt-20">
        <Card>
          <CardContent className="p-6 text-center space-y-6">
            <AlertCircle className="h-16 w-16 mx-auto text-red-600" />

            <div>
              <h1 className="text-2xl font-bold text-red-800 mb-2">เชื่อมต่อไม่สำเร็จ</h1>
              <p className="text-gray-600">{getErrorMessage(error)}</p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="font-semibold text-red-800 mb-2">วิธีแก้ไข:</h3>
              <ul className="text-sm text-red-700 space-y-1 text-left">
                <li>• ตรวจสอบว่าคุณได้ยื่นคำร้องแล้ว</li>
                <li>• คลิกลิงก์จาก LINE OA อีกครั้ง</li>
                <li>• หากยังไม่ได้ยื่นคำร้อง กรุณายื่นคำร้องก่อน</li>
                <li>• ติดต่อเจ้าหน้าที่หากยังมีปัญหา</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                ลองใหม่อีกครั้ง
              </Button>

              <Button onClick={handleClose} variant="outline" className="w-full">
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
          <p className="mt-2 text-red-600">📞 ติดต่อเจ้าหน้าที่: 032-123-4567</p>
        </div>
      </div>
    </div>
  )
}
