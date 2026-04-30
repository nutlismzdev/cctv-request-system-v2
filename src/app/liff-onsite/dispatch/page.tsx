'use client'

/**
 * LIFF Dispatch — single page ทำทั้ง init + link
 * --------------------------------------------------------------
 * เดิมเป็น 2-stage: /dispatch รับ liff.state → redirect ไป /dispatch/{r}/{t} → init+link
 * ปัญหา: liff.init() ที่ path ลึกใน LINE app trigger OAuth round-trip ภายในเสมอ
 * → callback กลับมา /dispatch?...&code=... → ของเรา redirect path ลึกอีก → ไม่มี SDK state ข้ามหน้า
 * → trigger OAuth ใหม่ → loop
 *
 * แก้: ทำทั้งหมดใน /dispatch หน้าเดียว ไม่ hard-navigate ออก
 * - liff.state มี ?reportId=&token= หรือ /reportId/token → manual parse
 * - เก็บลง sessionStorage แล้วเรียก liff.init() ที่นี่เลย
 * - หลัง init เสร็จ → render link UI inline (LiffLinkInner)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import { liffLog } from '@/lib/liff-debug-log'
import Image from 'next/image'
import type { LiffSDK } from '@/types/liff'

const ONSITE_LIFF_STORAGE_KEY = 'liff-onsite-redirect'
const ONSITE_LIFF_STORAGE_MAX_AGE_MS = 30 * 60 * 1000

type OnsiteLiffTarget = { reportId: string; token: string }
type Step = 'checking' | 'add-friend' | 'linking' | 'success' | 'error'

interface LinkStatus {
  success: boolean
  data?: { report_id: number; status: string; is_linked: boolean; line_user?: unknown }
  error?: string
}
interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

function getLiff(): LiffSDK | null {
  return typeof window !== 'undefined' ? window.liff ?? null : null
}

function ensureSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getLiff()) return resolve()
    const script = document.createElement('script')
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลด LIFF SDK ไม่สำเร็จ'))
    document.head.appendChild(script)
  })
}

function storeRedirectTarget(target: OnsiteLiffTarget): void {
  try {
    sessionStorage.setItem(
      ONSITE_LIFF_STORAGE_KEY,
      JSON.stringify({ ...target, ts: Date.now() })
    )
  } catch {}
}

function getStoredRedirectTarget(): OnsiteLiffTarget | null {
  try {
    const raw = sessionStorage.getItem(ONSITE_LIFF_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OnsiteLiffTarget> & { ts?: number }
    if (!parsed.reportId || !parsed.token || !parsed.ts) return null
    if (Date.now() - parsed.ts > ONSITE_LIFF_STORAGE_MAX_AGE_MS) {
      sessionStorage.removeItem(ONSITE_LIFF_STORAGE_KEY)
      return null
    }
    return { reportId: parsed.reportId, token: parsed.token }
  } catch {
    return null
  }
}

function parseLiffState(raw: string | null): OnsiteLiffTarget | null {
  if (!raw) return null
  try {
    const cleaned = raw.startsWith('?') ? raw.slice(1) : raw
    if (cleaned.startsWith('/')) {
      const segs = cleaned.split('?')[0].split('/').filter(Boolean)
      if (segs.length >= 2) return { reportId: segs[0], token: segs[1] }
    }
    const sp = new URLSearchParams(cleaned)
    const r = sp.get('reportId') || sp.get('r') || ''
    const tok = sp.get('token') || sp.get('t') || ''
    if (r && tok) return { reportId: r, token: tok }
  } catch {}
  return null
}

function DispatchInner() {
  const tSuccess = useTranslations('LiffLink.success')
  const searchParams = useSearchParams()
  const hasRunRef = useRef(false)

  const [target, setTarget] = useState<OnsiteLiffTarget | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLiffReady, setIsLiffReady] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')

  const linkReport = useCallback(
    async (reportId: string, token: string, userId: string) => {
      setCurrentStep('linking')
      const numericId = Number(reportId)
      if (!Number.isFinite(numericId) || numericId <= 0 || !token || !userId) {
        setErrorMsg(`ข้อมูลไม่ครบ`)
        setCurrentStep('error')
        return
      }
      try {
        const res = await fetch('/api/line/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: numericId, tracking_token: token, userId }),
        })
        const result: LinkStatus = await res.json()
        liffLog('dispatch:link-result', { ok: res.ok, result })
        if (res.ok && result.success) {
          setLinkStatus(result)
          setCurrentStep('success')
        } else {
          setErrorMsg(result.error || 'เกิดข้อผิดพลาดในการผูกคำร้อง')
          setCurrentStep('error')
        }
      } catch (e) {
        liffLog('dispatch:link-network-error', { err: e })
        setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
        setCurrentStep('error')
      }
    },
    []
  )

  useEffect(() => {
    liffLog('dispatch:effect-fire', {
      hasGuard: hasRunRef.current,
      sp: typeof window !== 'undefined' ? window.location.search : '',
    })
    if (hasRunRef.current) return
    hasRunRef.current = true
    let cancelled = false
    let stage = 'start'

    const fail = (msg: string) => {
      if (cancelled) return
      setErrorMsg(msg)
      setCurrentStep('error')
    }

    const run = async () => {
      try {
        // 1) หา target (reportId + token) จาก URL — direct query, liff.state, หรือ sessionStorage
        stage = 'parse-target'
        let resolved: OnsiteLiffTarget | null = null
        const direct = (searchParams.get('reportId') || searchParams.get('r') || '').trim()
        const directTok = (searchParams.get('token') || searchParams.get('t') || '').trim()
        if (direct && directTok) {
          resolved = { reportId: direct, token: directTok }
        } else {
          resolved = parseLiffState(searchParams.get('liff.state'))
        }
        if (!resolved) {
          resolved = getStoredRedirectTarget()
        }
        liffLog('dispatch:target-resolved', { resolved })
        if (!resolved) {
          fail('ไม่พบข้อมูลคำร้อง — กรุณาสแกน QR Code อีกครั้ง')
          return
        }
        storeRedirectTarget(resolved)
        if (!cancelled) setTarget(resolved)

        // 2) Load + init LIFF SDK ที่ Endpoint URL พื้นฐาน — ไม่ navigate ออก
        stage = 'load-sdk'
        liffLog('dispatch:stage', { stage })
        await ensureSDK()
        if (cancelled) return
        const liff = getLiff()
        if (!liff) {
          fail('โหลด LIFF SDK ไม่สำเร็จ')
          return
        }

        const liffId =
          process.env.NEXT_PUBLIC_LINE_LIFF_ONSITE_ID ||
          process.env.NEXT_PUBLIC_LINE_LIFF_ID ||
          ''
        if (!liffId) {
          fail('LIFF ID ไม่ถูกตั้งค่า')
          return
        }

        stage = 'liff-init'
        liffLog('dispatch:stage', { stage, liffId })
        await liff.init({ liffId })
        if (cancelled) return
        setIsLiffReady(true)
        liffLog('dispatch:init-ok', {
          isLoggedIn: liff.isLoggedIn?.() ?? null,
          isInClient: liff.isInClient?.() ?? null,
          os: liff.getOS?.() ?? null,
          version: liff.getVersion?.() ?? null,
        })

        // 3) Login check — ถ้าไม่ login ให้ liff.login() (จะ OAuth round-trip กลับมาที่หน้านี้เอง)
        if (!liff.isLoggedIn()) {
          if (liff.isInClient()) {
            fail('ไม่สามารถเข้าสู่ระบบ LINE ผ่าน LIFF ได้ กรุณาปิดแล้วสแกน QR ใหม่')
            return
          }
          liffLog('dispatch:before-login', { redirectUri: window.location.origin + '/liff-onsite/dispatch' })
          // redirect_uri = LIFF Endpoint URL พื้นฐาน (เพื่อ LINE Login ตรวจ callback ผ่าน)
          // หลัง OAuth กลับมา → effect รันใหม่ → liff.init() consume code → login OK
          liff.login({ redirectUri: window.location.origin + '/liff-onsite/dispatch' })
          return
        }

        // 4) Get friendship — ถ้า throw ให้ถือว่ายังไม่เป็นเพื่อน (ไม่หยุด flow)
        stage = 'get-friendship'
        liffLog('dispatch:stage', { stage })
        let isFriendFlag = false
        try {
          const friendship = await liff.getFriendship()
          isFriendFlag = friendship.friendFlag
        } catch (friendErr) {
          liffLog('dispatch:friendship-failed', { err: friendErr })
          isFriendFlag = false
        }
        if (cancelled) return
        setIsFriend(isFriendFlag)
        if (!isFriendFlag) {
          setCurrentStep('add-friend')
          return
        }

        // 5) Get profile + link
        stage = 'get-profile'
        liffLog('dispatch:stage', { stage })
        const prof = await liff.getProfile()
        const idToken = liff.getDecodedIDToken?.() ?? null
        const lineUserId = prof.userId || idToken?.sub || ''
        if (!lineUserId) {
          fail('ไม่สามารถดึง LINE user ID ได้ — กรุณาตรวจสอบ LIFF scope')
          return
        }
        if (cancelled) return
        setProfile({
          userId: lineUserId,
          displayName: prof.displayName,
          pictureUrl: prof.pictureUrl,
          statusMessage: prof.statusMessage,
        })

        stage = 'link-report'
        liffLog('dispatch:stage', { stage, userId: lineUserId })
        await linkReport(resolved.reportId, resolved.token, lineUserId)
      } catch (err) {
        if (cancelled) return
        const e = err as { code?: string; message?: string }
        const code = e.code || ''
        const msg = err instanceof Error ? err.message : String(err)
        liffLog('dispatch:error', { stage, code, msg, err })
        fail(`เกิดข้อผิดพลาด [${stage}${code ? ' / ' + code : ''}${msg ? ' / ' + msg : ''}]`)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddFriend = () => {
    const liff = getLiff()
    try {
      if (liff?.openWindow) {
        liff.openWindow({ url: 'https://line.me/R/ti/p/@513dlddc', external: true })
      } else {
        window.open('https://line.me/R/ti/p/@513dlddc', '_blank', 'noreferrer')
      }
    } catch {
      window.open('https://line.me/R/ti/p/@513dlddc', '_blank', 'noreferrer')
    }
  }

  const handleClose = () => {
    getLiff()?.closeWindow()
  }

  // ---------------------- UI ----------------------
  const reportId = target?.reportId || ''

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
            <div className="flex flex-col gap-3">
              <Button onClick={handleAddFriend} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="w-4 h-4 mr-2" />
                เพิ่มเพื่อน LINE OA
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
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
            <Button onClick={handleClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {tSuccess('close')}
            </Button>
          </div>
        )
      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-800">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-gray-600">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                ลองใหม่อีกครั้ง
              </Button>
              <Button onClick={handleClose} variant="outline" className="w-full">
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
      <div className="max-w-md mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className={`h-6 w-6 ${THEME_COLORS.primary}`} />
            <h1 className="text-lg font-bold">ผูกคำร้องกับ LINE</h1>
          </div>
          {isLiffReady && (
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </Button>
          )}
        </div>
      </div>
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-6">{renderContent()}</CardContent>
        </Card>
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>CCTV เทศบาลนครหัวหิน</p>
          <p>ระบบจัดการคำร้องขอดูภาพ</p>
        </div>
      </div>
    </div>
  )
}

export default function LiffDispatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <DispatchInner />
    </Suspense>
  )
}
