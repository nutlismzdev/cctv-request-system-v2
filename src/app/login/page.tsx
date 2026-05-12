'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { login } from '@/lib/auth'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [capsOn, setCapsOn] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [clock, setClock] = useState('')

  const cardRef = useRef<HTMLFormElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pwRef.current?.focus()
  }, [])

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      setClock(`${hh}:${mm}`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const on = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock')
    setCapsOn(!!on)
  }

  const triggerShake = () => setShakeKey(k => k + 1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || isSuccess) return

    if (!password) {
      setErrorMsg('กรุณาป้อนรหัสผ่าน')
      triggerShake()
      pwRef.current?.focus()
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    try {
      const result = await login(password)
      if (result.success) {
        setIsSuccess(true)
        toast.success('เข้าสู่ระบบสำเร็จ')
        setTimeout(() => router.push('/admin/request'), 450)
      } else {
        throw new Error(result.message || 'รหัสผ่านไม่ถูกต้อง')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setErrorMsg(message)
      toast.error(message)
      triggerShake()
      pwRef.current?.select()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-root">
      <section className="login-wrap">
        {/* Left — full-bleed photo */}
        <aside className="stage">
          <div className="stage-photo" />
          <div className="stage-tint" />

          <span className="brand-mark">
            <span className="brand-icon" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/icon-512.png" alt="" />
            </span>
            <span>เทศบาลนครหัวหิน</span>
          </span>

          <div className="stage-overlay">
            <h2 className="stage-headline">ระบบจัดการคำร้องขอภาพ CCTV</h2>
            <p className="stage-sub">สำหรับเจ้าหน้าที่ผู้ดูแลระบบ</p>
          </div>
        </aside>

        {/* Right — login form */}
        <div className="login-side">
          <div className="side-bg" aria-hidden="true">
            <div className="side-beams" />
            <svg
              className="side-polys"
              viewBox="0 0 400 800"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="poly-a" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3D8BFF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#002366" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="poly-b" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7CB2FF" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#002366" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points="0,0 230,0 70,220" fill="url(#poly-a)" />
              <polygon points="400,0 400,230 245,40" fill="url(#poly-b)" />
              <polygon points="0,800 210,800 0,610" fill="url(#poly-b)" />
              <polygon points="400,800 400,580 260,800" fill="url(#poly-a)" />
              <polygon points="380,380 322,420 380,460" fill="url(#poly-a)" opacity="0.55" />
              <polygon points="20,440 78,400 78,480" fill="url(#poly-b)" opacity="0.55" />
            </svg>
            <div className="side-orb side-orb-1" />
            <div className="side-orb side-orb-2" />
          </div>

          <span className="side-status" aria-hidden="true">
            <span className="status-dot" />
            <span>SECURE</span>
            {clock && <span className="status-time">· {clock}</span>}
          </span>

          <form
            ref={cardRef}
            key={shakeKey}
            className={`login-card${shakeKey > 0 ? ' shake' : ''}`}
            autoComplete="off"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="card-head">
              <span className="head-accent" aria-hidden="true">
                <span className="head-accent-bar" />
                <span className="head-accent-dot" />
              </span>
              <h1>ลงชื่อเข้าใช้งาน</h1>
              <p>ป้อนรหัสผ่านผู้ดูแลระบบ</p>
            </div>

            <div className="form">
              <div className="field">
                <div className="label-row">
                  <label htmlFor="pw">รหัสผ่าน</label>
                </div>
                <div className={`input${errorMsg ? ' has-error' : ''}`}>
                  <span className="ic-left" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    ref={pwRef}
                    id="pw"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="ป้อนรหัสผ่าน"
                    autoComplete="current-password"
                    value={password}
                    disabled={isLoading || isSuccess}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (errorMsg) setErrorMsg(null)
                    }}
                    onKeyDown={handleCaps}
                    onKeyUp={handleCaps}
                    onBlur={() => setCapsOn(false)}
                  />
                  <button
                    type="button"
                    className="toggle-pw"
                    aria-pressed={showPw}
                    aria-label="แสดง/ซ่อนรหัสผ่าน"
                    onClick={() => {
                      setShowPw(s => !s)
                      pwRef.current?.focus()
                    }}
                  >
                    {showPw ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.7 18.7 0 0 1 4.06-5.06" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="m1 1 22 22" />
                        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className={`help-row${errorMsg ? ' error' : ''}`}>
                  {errorMsg && (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </svg>
                      <span>{errorMsg}</span>
                    </>
                  )}
                  {capsOn && (
                    <span className="caps-pill">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 14 6-6 6 6" />
                        <path d="M6 18h12" />
                      </svg>
                      CAPS LOCK
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className={`submit${isLoading ? ' is-loading' : ''}${isSuccess ? ' is-success' : ''}`}
                disabled={isLoading || isSuccess}
              >
                <span className="label">{isSuccess ? 'เข้าสู่ระบบสำเร็จ' : 'เข้าสู่ระบบ'}</span>
                {!isSuccess && (
                  <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                )}
                <span className="spinner"><div /></span>
              </button>

              <div className="form-foot">
                <span className="foot-meta" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>การเชื่อมต่อปลอดภัย</span>
                </span>
                <Link href="/">กลับหน้าแรก</Link>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
