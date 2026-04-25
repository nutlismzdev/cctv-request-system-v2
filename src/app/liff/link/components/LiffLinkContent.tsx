'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import Image from 'next/image'
// Import LIFF types
import type { LiffSDK } from '@/types/liff'





type Step = 'checking' | 'add-friend' | 'linking' | 'success' | 'error'

export function LiffLinkContent() {
  const searchParams = useSearchParams()
  const reportId = searchParams.get('report_id')

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')

  /** helper: get LIFF safely */
  const getLiff = (): LiffSDK | null => (typeof window !== 'undefined' ? window.liff ?? null : null)

  /** Initialize LIFF */
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = getLiff()
        if (!liff) {
          setError('LIFF not available')
          setCurrentStep('error')
          return
        }

        // Initialize LIFF
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' })

        // Check if logged in
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        // Get profile (for potential future use)
        await liff.getProfile()

        // Check friendship
        await liff.getFriendship()

        setCurrentStep('add-friend')
      } catch (err) {
        console.error('LIFF init error:', err)
        setError('ไม่สามารถเชื่อมต่อกับ LINE ได้')
        setCurrentStep('error')
      } finally {
        setIsLoading(false)
      }
    }

    initLiff()
  }, [])


  /** Handle add friend */
  const handleAddFriend = useCallback(async () => {
    const liff = getLiff()
    if (liff && liff.openWindow) {
      liff.openWindow({ url: 'https://lin.ee/UFqUdB6', external: true })
    } else {
      window.open('https://lin.ee/UFqUdB6', '_blank', 'noreferrer')
    }
  }, [])


  /** Handle close */
  const handleClose = useCallback(() => {
    const liff = getLiff()
    if (liff && liff.closeWindow) {
      liff.closeWindow()
    } else {
      window.close()
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen ${THEME_COLORS.background} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">กำลังเชื่อมต่อกับ LINE...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${THEME_COLORS.background} p-4`}>
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-6">
          <Image
            src="/logo/1_0.ico"
            alt="เทศบาลนครหัวหิน"
            width={60}
            height={60}
            className="mx-auto mb-4"
          />
          <h1 className="text-xl font-bold text-gray-800">เชื่อมต่อคำร้องกับ LINE</h1>
          <p className="text-sm text-gray-600 mt-1">คำร้อง #{reportId}</p>
        </div>

        {/* Content based on step */}
        {currentStep === 'checking' && (
          <Card>
            <CardContent className="p-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-lg font-semibold mb-2">กำลังตรวจสอบ...</h2>
              <p className="text-gray-600">กรุณารอสักครู่</p>
            </CardContent>
          </Card>
        )}

        {currentStep === 'add-friend' && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <MessageCircle className="h-12 w-12 mx-auto text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold mb-2">เพิ่มเพื่อน LINE OA</h2>
                <p className="text-gray-600 text-sm">
                  คุณยังไม่ได้เพิ่ม LINE Official Account ของเราเป็นเพื่อน
                  เพื่อรับแจ้งเตือนเมื่อสถานะคำร้องเปลี่ยนแปลง
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>ขั้นตอน:</strong> คลิกปุ่มด้านล่างเพื่อเพิ่มเพื่อน LINE OA จากนั้นกลับมาที่หน้านี้เพื่อเชื่อมต่อคำร้อง
                </p>
              </div>

              <Button onClick={handleAddFriend} className="w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                เพิ่มเพื่อน LINE OA
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 'linking' && (
          <Card>
            <CardContent className="p-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-lg font-semibold mb-2">กำลังเชื่อมต่อ...</h2>
              <p className="text-gray-600">กรุณารอสักครู่</p>
            </CardContent>
          </Card>
        )}

        {currentStep === 'success' && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-green-800 mb-2">เชื่อมต่อสำเร็จ!</h2>
                <p className="text-gray-600 text-sm">
                  คำร้อง #{reportId} ได้ถูกเชื่อมโยงกับ LINE ของคุณเรียบร้อยแล้ว
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">คุณจะได้รับแจ้งเตือนเมื่อ:</h3>
                <ul className="text-sm text-green-700 space-y-1 text-left">
                  <li>• สถานะคำร้องมีการเปลี่ยนแปลง</li>
                  <li>• เอกสารพร้อมให้ดาวน์โหลด</li>
                  <li>• มีข้อมูลเพิ่มเติมจากเจ้าหน้าที่</li>
                </ul>
              </div>

              <Button onClick={handleClose} className="w-full bg-green-600 hover:bg-green-700 text-white">
                ปิดหน้านี้
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 'error' && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-red-800 mb-2">เกิดข้อผิดพลาด</h2>
                <p className="text-gray-600 text-sm">{error}</p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-800 mb-2">วิธีแก้ไข:</h3>
                <ul className="text-sm text-red-700 space-y-1 text-left">
                  <li>• ตรวจสอบว่าได้เข้าสู่ระบบ LINE แล้ว</li>
                  <li>• ลองใหม่อีกครั้ง</li>
                  <li>• ติดต่อเจ้าหน้าที่หากยังมีปัญหา</li>
                </ul>
              </div>

              <Button onClick={handleClose} variant="outline" className="w-full">
                ปิดหน้านี้
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>CCTV เทศบาลนครหัวหิน</p>
          <p>ระบบจัดการคำร้องขอดูภาพ</p>
        </div>
      </div>
    </div>
  )
}
