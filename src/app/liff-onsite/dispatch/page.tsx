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
import { preload } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { CheckCircle2, MessageCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { THEME_COLORS } from '@/lib/theme-colors'
import { liffLog } from '@/lib/liff-debug-log'
import Image from 'next/image'
import type { LiffSDK } from '@/types/liff'

const ONSITE_LIFF_STORAGE_KEY = 'liff-onsite-redirect'
const ONSITE_LIFF_STORAGE_MAX_AGE_MS = 30 * 60 * 1000
const ADD_FRIEND_AWAIT_KEY = 'lineoa-onsite-awaiting-friend'
const ADD_FRIEND_URL = 'https://line.me/R/ti/p/@513dlddc'
const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js'

type OnsiteLiffTarget = { reportId: string; token: string }
// 'pending-friend' = ผูกคำร้องสำเร็จแล้ว แต่ยังต้องเพิ่มเพื่อนเพื่อรับลิงก์วิดีโอ
type Step = 'checking' | 'linking' | 'pending-friend' | 'success' | 'error'

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
    script.src = LIFF_SDK_URL
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
  // Rule: rendering-resource-hints — เริ่ม fetch LIFF SDK พร้อมๆ กับที่ React render
  // ถึงตอน useEffect เรียก ensureSDK() ใน setTimeout ของ event loop ถัดไป
  // browser จะมี script cache อยู่แล้ว → ลด cold start 100-300ms
  preload(LIFF_SDK_URL, { as: 'script' })

  const tSuccess = useTranslations('LiffLink.success')
  const tPending = useTranslations('LiffLink.pendingFriend')
  const searchParams = useSearchParams()
  const hasRunRef = useRef(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLiffReady, setIsLiffReady] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('checking')
  const [isPolling, setIsPolling] = useState(false)

  const linkReport = useCallback(
    async (reportId: string, token: string, userId: string, friendFlag: boolean) => {
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
          body: JSON.stringify({
            report_id: numericId,
            tracking_token: token,
            userId,
            is_friend: friendFlag,
          }),
        })
        const result: LinkStatus = await res.json()
        liffLog('dispatch:link-result', { ok: res.ok, result, friendFlag })
        // 409 = already linked → ถือว่า success (แค่ไม่ link ซ้ำ) ผู้ใช้ยังต้องเพิ่มเพื่อนถ้ายังไม่ใช่
        const alreadyLinked = res.status === 409
        if ((res.ok && result.success) || alreadyLinked) {
          setLinkStatus(alreadyLinked ? { success: true, error: result.error } : result)
          setCurrentStep(friendFlag ? 'success' : 'pending-friend')
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

        // 4-5) Parallel: getFriendship + getProfile
        // Rule: async-parallel — เรียก LINE backend คนละ endpoint ไม่ขึ้นต่อกัน
        // เดิม sequential (~400-800ms) → parallel (~200-400ms)
        // ⚠️ สำคัญ: ไม่ block flow ที่ friendship — ผูกคำร้องก่อนเสมอ แล้วบังคับเพิ่มเพื่อนหลัง link สำเร็จ
        stage = 'get-friendship-and-profile'
        liffLog('dispatch:stage', { stage })
        const [friendshipResult, prof] = await Promise.all([
          liff.getFriendship().catch((friendErr) => {
            liffLog('dispatch:friendship-failed', { err: friendErr })
            return { friendFlag: false }
          }),
          liff.getProfile(),
        ])
        if (cancelled) return
        const isFriendFlag = friendshipResult.friendFlag
        setIsFriend(isFriendFlag)

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
        liffLog('dispatch:stage', { stage, userId: lineUserId, isFriendFlag })
        await linkReport(resolved.reportId, resolved.token, lineUserId, isFriendFlag)
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

  const handleAddFriend = useCallback(() => {
    setIsPolling(true)
    try { sessionStorage.setItem(ADD_FRIEND_AWAIT_KEY, '1') } catch {}
    const liff = getLiff()
    // external: false → เปิด in-app window ของ LINE → กลับมาที่ dispatch ได้เนียน
    // เมื่อ user ปิด add-friend window → pageshow/visibilitychange จะ trigger re-check
    try {
      if (liff?.openWindow) {
        liff.openWindow({ url: ADD_FRIEND_URL, external: false })
        return
      }
    } catch {}
    window.location.href = ADD_FRIEND_URL
  }, [])

  const handleRecheck = useCallback(async () => {
    const liff = getLiff()
    if (!liff) return
    setIsPolling(true)
    try {
      const friendship = await liff.getFriendship()
      if (friendship.friendFlag) {
        setIsFriend(true)
        setCurrentStep('success')
        try { sessionStorage.removeItem(ADD_FRIEND_AWAIT_KEY) } catch {}
      }
    } catch (err) {
      liffLog('dispatch:recheck-failed', { err })
    } finally {
      setIsPolling(false)
    }
  }, [])

  // Polling + page-visibility listeners ตอนรอ user เพิ่มเพื่อน
  // ไม่ต้องให้ user กดปุ่มตรวจเอง — กลับมา tab/visibility = re-check ทันที
  useEffect(() => {
    if (currentStep !== 'pending-friend') return
    if (typeof window === 'undefined') return
    const liff = getLiff()
    if (!liff) return

    let cancelled = false

    const checkOnce = async () => {
      try {
        const result = await Promise.race([
          liff.getFriendship(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('timeout')), 2500)
          ),
        ])
        if (cancelled) return
        if (result.friendFlag) {
          setIsFriend(true)
          setCurrentStep('success')
          try { sessionStorage.removeItem(ADD_FRIEND_AWAIT_KEY) } catch {}
        }
      } catch {
        /* swallow */
      }
    }

    const interval = window.setInterval(() => { void checkOnce() }, 2000)

    const onPageShow = () => { void checkOnce() }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkOnce()
    }
    const onFocus = () => { void checkOnce() }

    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [currentStep])

  const handleClose = () => {
    try { sessionStorage.removeItem(ADD_FRIEND_AWAIT_KEY) } catch {}
    getLiff()?.closeWindow()
  }

  // ---------------------- UI ----------------------
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
      case 'pending-friend':
        return (
          <div className="text-center space-y-5">
            {/* ป้าย "ผูกคำร้องเรียบร้อย" — ยืนยันว่าขั้นตอน QR-link สำเร็จแล้ว */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              {tPending('linkedBadge')}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">{tPending('title')}</h2>
              <p className="text-sm leading-relaxed text-slate-500">
                {tPending('description')}
              </p>
            </div>

            {/* Critical warning — เน้นว่าถ้าไม่กด รับวิดีโอไม่ได้ */}
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left">
              <div className="flex gap-2.5">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-amber-600" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900">{tPending('criticalTitle')}</p>
                  <p className="text-xs leading-relaxed text-amber-800">{tPending('criticalNote')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleAddFriend}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-semibold shadow-md shadow-green-600/25"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {tPending('addFriendButton')}
              </Button>

              {isPolling ? (
                <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tPending('polling')}
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => void handleRecheck()}
                  className="w-full"
                >
                  {tPending('recheck')}
                </Button>
              )}
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
            <Button onClick={handleClose} className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white">
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
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <DispatchInner />
    </Suspense>
  )
}
