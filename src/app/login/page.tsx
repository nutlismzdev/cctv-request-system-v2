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
      <main className="page">
        <section className="login-wrap">
          {/* Brand / hero panel */}
          <aside className="stage">
            <div className="stage-photo" />
            <div className="stage-tint" />
            <div className="stage-grain" aria-hidden="true" />

            <div className="stage-spine" aria-hidden="true">
              <span>FRAME-04 · HUA HIN MUNICIPAL</span>
              <span>CCTV · CTRL · 2026</span>
            </div>

            <span className="vf-mark" aria-hidden="true" />

            <div className="stage-top">
              <span className="brand-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                  <path d="m22 8-6 4 6 4V8z" />
                </svg>
                <span>เทศบาลนครหัวหิน</span>
              </span>
              <span className="live-pill">
                <span className="live-dot" />
                LIVE
                {clock && <span className="live-time">· {clock}</span>}
              </span>
            </div>

            <div className="stage-overlay">
              <span className="stage-eyebrow">
                <span className="dot" /> สำหรับเจ้าหน้าที่ผู้ดูแลระบบ
              </span>
              <h2 className="stage-headline">
                ระบบจัดการคำร้อง
                <br />
                <span className="accent">ขอภาพ CCTV</span>
              </h2>
              <p className="stage-tagline">
                บริหารจัดการคำร้องขอภาพจากกล้องวงจรปิดอย่างเป็นระบบ
                ปลอดภัย รวดเร็ว และตรวจสอบย้อนหลังได้
              </p>

              <ul className="stage-trust" aria-label="คุณสมบัติของระบบ">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  เข้ารหัสปลอดภัย
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  บันทึกการใช้งาน
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7 9 18l-5-5" />
                  </svg>
                  ยืนยันสิทธิ์ผู้ใช้งาน
                </li>
              </ul>
            </div>
          </aside>

          {/* Login card */}
          <div className="login-side">
            <form
              ref={cardRef}
              key={shakeKey}
              className={`login-card${shakeKey > 0 ? ' shake' : ''}`}
              autoComplete="off"
              noValidate
              onSubmit={handleSubmit}
            >
              <div className="card-head">
                <span className="badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <div className="card-head-text">
                  <h1>ลงชื่อเข้าใช้งาน</h1>
                  <p>กรุณาป้อนรหัสผ่านของผู้ดูแลระบบเพื่อดำเนินการต่อ</p>
                </div>
                <span className="card-rev" aria-hidden="true">REV 2.4</span>
              </div>

              <div className="form">
                <div className="field">
                  <div className="label-row">
                    <label htmlFor="pw">รหัสผ่าน</label>
                    {password.length > 0 && (
                      <span className="meta">{password.length} ตัวอักษร</span>
                    )}
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
                    {errorMsg ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    )}
                    <span>{errorMsg ?? 'เฉพาะผู้ดูแลระบบเท่านั้น'}</span>
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

                <div className="shortcut-hint" aria-hidden="true">
                  <kbd>Enter</kbd>
                  <span>เพื่อเข้าสู่ระบบ</span>
                </div>

                <div className="form-foot">
                  <span className="secure">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    การเชื่อมต่อปลอดภัย
                  </span>
                  <Link href="/">กลับหน้าแรก</Link>
                </div>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="inner">
          <span>© 2567 เทศบาลนครหัวหิน. สงวนลิขสิทธิ์.</span>
          <div className="links">
            <Link href="/">หน้าแรก</Link>
            <Link href="/request">ยื่นคำร้อง</Link>
            <Link href="/request/status">ตรวจสอบสถานะ</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
