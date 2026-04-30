'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import Image from 'next/image'
// Import LIFF types
import type { LiffSDK } from '@/types/liff'





type Step = 'checking' | 'add-friend' | 'linking' | 'success' | 'error'

interface LinkStatus {
  success: boolean
  error?: string
}

async function ensureLiffSdk(): Promise<LiffSDK | null> {
  if (typeof window === 'undefined') return null
  if (window.liff) return window.liff

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-liff-sdk="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('โหลด LIFF SDK ไม่สำเร็จ')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
    script.async = true
    script.dataset.liffSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลด LIFF SDK ไม่สำเร็จ'))
    document.head.appendChild(script)
  })

  return window.liff ?? null
}

export function LiffLinkContent() {
  const tSuccess = useTranslations('LiffLink.success')
  const searchParams = useSearchParams()
  const reportId = searchParams.get('report_id')
  const token = searchParams.get('t') || searchParams.get('tracking_token')

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')

  /** helper: get LIFF safely */
  const getLiff = (): LiffSDK | null => (typeof window !== 'undefined' ? window.liff ?? null : null)

  const linkReport = useCallback(
    async (userId: string) => {
      setCurrentStep('linking')

      const response = await fetch('/api/line/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: Number(reportId),
          tracking_token: token,
          userId,
        }),
      })

      const result: LinkStatus = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการผูกคำร้อง')
      }

      setCurrentStep('success')
    },
    [reportId, token]
  )

  /** Initialize LIFF */
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!reportId || !token) {
          setError('ลิงก์นี้ไม่มีข้อมูลคำร้อง กรุณากดปุ่มเชื่อมต่อ LINE จากหน้าส่งคำร้องสำเร็จอีกครั้ง')
          setCurrentStep('error')
          return
        }

        const liff = await ensureLiffSdk()
        if (!liff) {
          setError('LIFF not available')
          setCurrentStep('error')
          return
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_LINE_LIFF_ID || ''
        if (!liffId) {
          setError('ยังไม่ได้ตั้งค่า LIFF ID ในระบบ')
          setCurrentStep('error')
          return
        }

        // Initialize LIFF
        await liff.init({ liffId })

        // Check if logged in
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }

        // Check friendship
        const friendship = await liff.getFriendship()
        if (!friendship.friendFlag) {
          setCurrentStep('add-friend')
          return
        }

        const profile = await liff.getProfile()
        await linkReport(profile.userId)
      } catch (err) {
        console.error('LIFF init error:', err)
        setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อกับ LINE ได้')
        setCurrentStep('error')
      } finally {
        setIsLoading(false)
      }
    }

    void initLiff()
  }, [linkReport, reportId, token])


  /** Handle add friend */
  const handleAddFriend = useCallback(async () => {
    const liff = getLiff()
    if (liff && liff.openWindow) {
      liff.openWindow({ url: 'https://line.me/R/ti/p/@513dlddc', external: true })
    } else {
      window.open('https://line.me/R/ti/p/@513dlddc', '_blank', 'noreferrer')
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
                <h2 className="text-lg font-semibold text-green-800 mb-2">{tSuccess('title')}</h2>
                <p className="text-gray-600 text-sm">
                  {tSuccess('description')}
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">{tSuccess('notifyTitle')}</h3>
                <ul className="text-sm text-green-700 space-y-1 text-left">
                  <li>• {tSuccess('notifyItem1')}</li>
                  <li>• {tSuccess('notifyItem2')}</li>
                  <li>• {tSuccess('notifyItem3')}</li>
                </ul>
              </div>

              <Button onClick={handleClose} className="w-full bg-green-600 hover:bg-green-700 text-white">
                {tSuccess('close')}
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
