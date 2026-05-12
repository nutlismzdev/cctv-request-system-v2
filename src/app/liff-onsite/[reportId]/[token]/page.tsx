'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import { liffLog } from '@/lib/liff-debug-log'
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
  const tSuccess = useTranslations('LiffLink.success')
  const params = useParams() as { reportId?: string; token?: string }
  const searchParams = useSearchParams()
  // ดึงเป็น primitive string (กฎ rerender-dependencies — ห้ามเอา object เป็น dep ของ effect)
  const paramReportId = params.reportId || ''
  const paramToken = params.token || ''
  const queryReportId = searchParams.get('reportId') || searchParams.get('r') || ''
  const queryToken = searchParams.get('token') || searchParams.get('t') || ''
  // derived state — คำนวณตอน render (กฎ rerender-derived-state-no-effect)
  const reportId = paramReportId || queryReportId
  const token = paramToken || queryToken

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLiffReady, setIsLiffReady] = useState<boolean>(false)
  const [isFriend, setIsFriend] = useState<boolean>(false)
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')
  // กัน initLiff ถูกเรียกซ้ำเมื่อ deps ของ useEffect เปลี่ยน reference
  // (linkReport เป็น useCallback แต่ deps reportId/token เปลี่ยนได้ตอน hydrate, useParams ก็คืน object ใหม่ทุก render)
  const initStartedRef = useRef(false)

  /** helper: get LIFF safely */
  const getLiff = (): LiffSDK | null => (typeof window !== 'undefined' ? window.liff ?? null : null)

  // Link report function
  const linkReport = useCallback(
    async (userId: string) => {
      try {
        setCurrentStep('linking')

        const numericReportId = Number(reportId)
        if (!Number.isFinite(numericReportId) || numericReportId <= 0 || !token || !userId) {
          setError(`ข้อมูลไม่ครบ: reportId=${reportId} token=${token ? 'มี' : 'ไม่มี'} userId=${userId ? 'มี' : 'ไม่มี'}`)
          setCurrentStep('error')
          setIsLoading(false)
          return
        }

        const response = await fetch('/api/line/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_id: numericReportId,
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
  // dep เป็น primitive (reportId, token) เท่านั้น (กฎ rerender-dependencies)
  // initStartedRef กัน effect re-run จากสาเหตุอื่น (กฎ advanced-init-once)
  useEffect(() => {
    liffLog('link-page:effect-fire', {
      reportId,
      token,
      hasGuard: initStartedRef.current,
    })
    if (initStartedRef.current) {
      liffLog('link-page:effect-skip-already-started', {})
      return
    }
    if (!reportId || !token) {
      liffLog('link-page:effect-skip-no-params', { reportId, token })
      return
    }
    initStartedRef.current = true
    let cancelled = false
    let stage = 'start'
    const initLiff = async () => {
      try {
        liffLog('link-page:init-start', { reportId, token })
        // Guard: ถ้าเข้ามาที่ path /liff-onsite/[id]/[token] โดยตรง (ไม่ผ่าน /dispatch/)
        // → redirect ไป /dispatch/ เพื่อให้ LIFF SDK init ใต้ Endpoint URL ที่ถูกต้อง
        // (LIFF Endpoint URL = /liff-onsite/dispatch — ห้าม init นอกพาธนี้)
        const currentPath = window.location.pathname
        if (!currentPath.startsWith('/liff-onsite/dispatch')) {
          liffLog('link-page:redirect-to-dispatch', { from: currentPath })
          window.location.replace(
            `/liff-onsite/dispatch/${encodeURIComponent(reportId)}/${encodeURIComponent(token)}`
          )
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

        stage = 'load-sdk'
        liffLog('link-page:stage', { stage })
        await ensureSDK()
        if (cancelled) return
        const liff = getLiff()
        if (!liff) throw new Error('ไม่พบ LIFF SDK')
        liffLog('link-page:sdk-loaded', { hasLiff: !!liff })

        // ต้องใช้ LIFF ID เดียวกับที่ encode ใน QR (success-onsite ใช้ NEXT_PUBLIC_LINE_LIFF_ONSITE_ID เป็นหลัก)
        const onsiteLiffId =
          process.env.NEXT_PUBLIC_LINE_LIFF_ONSITE_ID ||
          process.env.NEXT_PUBLIC_LINE_LIFF_ID ||
          ''
        if (!onsiteLiffId) {
          setError('LIFF ID ไม่ถูกตั้งค่า')
          setCurrentStep('error')
          setIsLoading(false)
          return
        }

        stage = 'liff-init'
        liffLog('link-page:stage', { stage, liffId: onsiteLiffId })
        // ป้องกัน init ซ้ำ — บน mobile path-based unwrap ของ LIFF web อาจเรียก init ไปแล้ว
        // เรียก init ซ้ำบน SDK เดิม จะ resolve ทันที ไม่ throw แต่ต้อง await กัน race
        await liff.init({ liffId: onsiteLiffId })
        if (cancelled) return
        setIsLiffReady(true)
        liffLog('link-page:init-ok', {
          isLoggedIn: liff.isLoggedIn?.() ?? null,
          isInClient: liff.isInClient?.() ?? null,
          os: liff.getOS?.() ?? null,
          version: liff.getVersion?.() ?? null,
          lineVersion: liff.getLineVersion?.() ?? null,
        })

        if (!liff.isLoggedIn()) {
          if (liff.isInClient()) {
            liffLog('link-page:in-client-not-logged-in', {})
            // ใน LINE app แต่ไม่ login = session ใน LINE app เพี้ยน → ให้ user ปิด LIFF window แล้วสแกนใหม่
            setError('ไม่สามารถเข้าสู่ระบบ LINE ผ่าน LIFF ได้ กรุณาปิดแล้วสแกน QR ใหม่อีกครั้ง')
            setCurrentStep('error')
            setIsLoading(false)
            return
          }

          // เกิดเฉพาะกรณีสแกนนอก LINE app (กล้องมือถือ → external browser)
          // OAuth round-trip ต้องใช้ redirect_uri = LIFF Endpoint URL พื้นฐาน
          // ส่ง path ลึก (reportId/token) → LINE Login ตอบ 400 Bad Request
          // → เก็บ reportId/token ลง sessionStorage แล้วส่งกลับมาที่ /liff-onsite/dispatch/callback
          try {
            sessionStorage.setItem(
              'liff-onsite-redirect',
              JSON.stringify({ reportId, token, ts: Date.now() })
            )
          } catch {}
          const callbackUrl = `${window.location.origin}/liff-onsite/dispatch/callback`
          liffLog('link-page:before-liff-login', { callbackUrl })
          liff.login({ redirectUri: callbackUrl })
          return
        }

        stage = 'get-friendship'
        liffLog('link-page:stage', { stage })
        // getFriendship throw เมื่อ LIFF ไม่ได้ link OA หรือ OA ต่าง provider
        // → จับเฉพาะ error นี้ ให้ข้ามไป add-friend step แทนหยุดทั้ง flow
        let isFriendFlag = false
        try {
          const friendship = await liff.getFriendship()
          isFriendFlag = friendship.friendFlag
          liffLog('link-page:friendship-ok', { isFriendFlag })
        } catch (friendErr) {
          liffLog('link-page:friendship-failed', { err: friendErr })
          console.warn('getFriendship failed (อาจเพราะยังไม่ link OA):', friendErr)
          isFriendFlag = false
        }
        setIsFriend(isFriendFlag)

        if (!isFriendFlag) {
          setCurrentStep('add-friend')
          setIsLoading(false)
          return
        }

        stage = 'get-profile'
        liffLog('link-page:stage', { stage })
        const prof = await liff.getProfile()
        liffLog('link-page:profile-ok', { hasUserId: !!prof.userId, displayName: prof.displayName })
        // ใช้ prof.userId เป็นหลัก (มาจาก scope `profile`) — ไม่พึ่ง openid scope
        // fallback ไป idToken.sub กรณี profile ไม่ส่ง userId ด้วยเหตุผลใด ๆ
        const idToken = liff.getDecodedIDToken?.() ?? null
        const lineUserId = prof.userId || idToken?.sub || ''

        if (!lineUserId) {
          setError('ไม่สามารถดึง LINE user ID ได้ — กรุณาตรวจสอบ LIFF scope')
          setCurrentStep('error')
          setIsLoading(false)
          return
        }

        setProfile({
          userId: lineUserId,
          displayName: prof.displayName,
          pictureUrl: prof.pictureUrl,
          statusMessage: prof.statusMessage
        })

        stage = 'link-report'
        liffLog('link-page:stage', { stage, userId: lineUserId })
        setCurrentStep('linking')
        await linkReport(lineUserId)
        liffLog('link-page:done', {})
      } catch (err) {
        if (cancelled) return
        // ดึง error code จาก LIFF SDK (LiffError มี .code เช่น INIT_FAILED, FORBIDDEN)
        const e = err as { code?: string; message?: string } | Error
        const errCode = (e as { code?: string }).code || ''
        const errMsg = e instanceof Error ? e.message : String(e)
        liffLog('link-page:error', { stage, code: errCode, msg: errMsg, err })
        console.error('[LIFF] error at stage:', stage, '| code:', errCode, '| msg:', errMsg, '| raw:', err)
        const detail = [stage, errCode, errMsg].filter(Boolean).join(' / ')
        setError(`เกิดข้อผิดพลาดในการเชื่อมต่อ LINE [${detail}]`)
        setCurrentStep('error')
        setIsLoading(false)
      }
    }

    void initLiff()
    return () => {
      cancelled = true
    }
    // primitive deps เท่านั้น — linkReport stable แล้วผ่าน useCallback แต่ไม่ต้องใส่
    // เพราะ guard initStartedRef.current กันการ re-run อยู่แล้ว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, token])

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'checking':
        return (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
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

            <div className="bg-[var(--primary)]/5 p-4 rounded-lg border border-[var(--primary)]/20">
              <h3 className="font-semibold text-[var(--primary)] mb-2">วิธีเพิ่มเพื่อน</h3>
              <ol className="text-sm text-[var(--primary)] space-y-1 text-left">
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
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

            <div className="bg-[var(--primary)]/5 p-4 rounded-lg border border-[var(--primary)]/20">
              <h3 className="font-semibold text-[var(--primary)] mb-2">{tSuccess('notifyTitle')}</h3>
              <ul className="text-sm text-[var(--primary)] space-y-1 text-left">
                <li>• {tSuccess('notifyItem1')}</li>
                <li>• {tSuccess('notifyItem2')}</li>
                <li>• {tSuccess('notifyItem3')}</li>
              </ul>
            </div>

            <Button
              onClick={handleClose}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white"
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
