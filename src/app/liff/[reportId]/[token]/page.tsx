'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import Image from 'next/image'
// Import LIFF types
import type { LiffSDK } from '@/types/liff'

interface LinkStatus {
  success: boolean
  data?: {
    report_id: number
    status: string
    is_linked: boolean
    line_user?: unknown
  }
  error?: string
}

interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}


type Step = 'checking' | 'add-friend' | 'linking' | 'success' | 'error'

export default function LiffLinkPage() {
  const params = useParams() as { reportId?: string; token?: string }
  const reportId = params.reportId ?? ''
  const token = params.token ?? ''
  const tSuccess = useTranslations('LiffLink.success')

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLiffReady, setIsLiffReady] = useState<boolean>(false)
  const [isFriend, setIsFriend] = useState<boolean>(false)
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')

  /** helper: get LIFF safely */
  const getLiff = (): LiffSDK | null => (typeof window !== 'undefined' ? window.liff ?? null : null)

  // Link report function
  const linkReport = useCallback(
    async (userId: string) => {
      try {
        setCurrentStep('linking')

        const response = await fetch('/api/line/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_id: Number(reportId),
            tracking_token: token,
            userId
          })
        })

        const result: LinkStatus = await response.json()

        if (response.ok && result.success) {
          setLinkStatus(result)
          setCurrentStep('success')
        } else {
          setError(result.error || 'เกิดข้อผิดพลาดในการผูกคำร้อง')
          setCurrentStep('error')
        }
      } catch (err) {
     
        console.error('Link report error:', err)
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
        setCurrentStep('error')
      } finally {
        setIsLoading(false)
      }
    },
    [reportId, token]
  )

  // Handle add friend
  const handleAddFriend = useCallback(async () => {
    try {
      const liff = getLiff()
      if (liff && liff.openWindow) {
        liff.openWindow({ url: 'https://line.me/R/ti/p/@513dlddc', external: true })
      } else {
        window.open('https://line.me/R/ti/p/@513dlddc', '_blank', 'noreferrer')
      }
    } catch (err) {
    
      console.error('Error opening add friend page:', err)
      window.open('https://line.me/R/ti/p/@513dlddc', '_blank', 'noreferrer')
    }
  }, [])

  // Handle close LIFF
  const handleClose = useCallback(() => {
    const liff = getLiff()
    if (liff) liff.closeWindow()
  }, [])

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!reportId || !token) {
          setError('ข้อมูลคำร้องไม่ถูกต้อง')
          setCurrentStep('error')
          setIsLoading(false)
          return
        }

        const ensureSDK = async (): Promise<void> =>
          new Promise((resolve, reject) => {
            if (getLiff()) {
              resolve()
              return
            }
            const script = document.createElement('script')
            script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('โหลด LIFF SDK ไม่สำเร็จ'))
            document.head.appendChild(script)
          })

        await ensureSDK()
        const liff = getLiff()
        if (!liff) throw new Error('ไม่พบ LIFF SDK')

        await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || 'YOUR_LIFF_ID' })
        setIsLiffReady(true)

        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const friendship = await liff.getFriendship()
        setIsFriend(friendship.friendFlag)

        if (!friendship.friendFlag) {
          setCurrentStep('add-friend')
          setIsLoading(false)
          return
        }

        const idToken = liff.getDecodedIDToken()
        const prof = await liff.getProfile()

        setProfile({
          userId: idToken.sub,
          displayName: prof.displayName,
          pictureUrl: prof.pictureUrl,
          statusMessage: prof.statusMessage
        })

        setCurrentStep('linking')
        await linkReport(idToken.sub)
      } catch (err) {
       
        console.error('LIFF initialization error:', err)
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อ LINE')
        setCurrentStep('error')
        setIsLoading(false)
      }
    }

    void initLiff()
  }, [reportId, token, linkReport])

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'checking':
        return (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-lg font-semibold mb-2">กำลังตรวจสอบ...</h2>
            <p className="text-sm text-gray-600">กรุณารอสักครู่</p>
          </div>
        )

      case 'add-friend':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
            <h2 className="text-xl font-bold">กรุณาเพิ่มเพื่อน LINE OA</h2>
            <p className="text-sm text-gray-600">
              คุณต้องเป็นเพื่อนกับ CCTV เทศบาลนครหัวหิน Official ก่อนจึงจะสามารถผูกคำร้องได้
            </p>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">วิธีเพิ่มเพื่อน</h3>
              <ol className="text-sm text-blue-700 space-y-1 text-left">
                <li>1. คลิกปุ่ม &quot;เพิ่มเพื่อน LINE OA&quot; ด้านล่าง</li>
                <li>2. กด &quot;เพิ่มเพื่อน&quot; ในหน้า LINE</li>
                <li>3. กลับมาที่หน้านี้เพื่อดำเนินการต่อ</li>
              </ol>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleAddFriend}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={isLoading}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                เพิ่มเพื่อน LINE OA
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปตรวจสอบใหม่
              </Button>
            </div>
          </div>
        )

      case 'linking':
        return (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-lg font-semibold mb-2">กำลังผูกคำร้อง...</h2>
            <p className="text-sm text-gray-600">กรุณารอสักครู่</p>
            {profile && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">ผู้ใช้: {profile.displayName}</p>
                <p className="text-xs text-gray-500">ID: {profile.userId}</p>
                <p className="text-xs text-gray-500">
                  สถานะเพื่อน OA: {isFriend ? 'เป็นเพื่อน' : 'ยังไม่เป็นเพื่อน'}
                </p>
              </div>
            )}
          </div>
        )

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-bold text-green-800">{tSuccess('title')}</h2>
            <p className="text-sm text-gray-600">
              {tSuccess('description')}
            </p>

            {profile && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  {profile.pictureUrl && (
                    <Image
                      src={profile.pictureUrl}
                      alt={profile.displayName}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}
                  <div className="text-left">
                    <p className="font-medium text-green-800">{profile.displayName}</p>
                    <p className="text-xs text-green-600">{tSuccess('connected')}</p>
                    <p className="text-xs text-green-600">
                      {tSuccess('friendStatusLabel')} {isFriend ? tSuccess('friendYes') : tSuccess('friendNo')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {linkStatus?.success && (
              <p className="text-xs text-gray-600">{tSuccess('linkedNote')}</p>
            )}

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">{tSuccess('notifyTitle')}</h3>
              <ul className="text-sm text-blue-700 space-y-1 text-left">
                <li>• {tSuccess('notifyItem1')}</li>
                <li>• {tSuccess('notifyItem2')}</li>
                <li>• {tSuccess('notifyItem3')}</li>
              </ul>
            </div>

            <Button
              onClick={handleClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {tSuccess('close')}
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-800">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-gray-600">{error}</p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                ลองใหม่อีกครั้ง
              </Button>

              <Button onClick={handleClose} variant="outline" className="w-full" disabled={isLoading}>
                ปิดหน้านี้
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`min-h-screen ${THEME_COLORS.background} p-4`}>
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className={`h-6 w-6 ${THEME_COLORS.primary}`} />
            <h1 className="text-lg font-bold">ผูกคำร้องกับ LINE</h1>
          </div>
          {isLiffReady && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={isLoading}
            >
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-6">{renderContent()}</CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>CCTV เทศบาลนครหัวหิน</p>
          <p>ระบบจัดการคำร้องขอดูภาพ</p>
        </div>
      </div>
    </div>
  )
}
