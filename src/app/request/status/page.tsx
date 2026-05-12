// src/app/request/status/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Search, AlertCircle, Info, Clock, MapPin, Phone, MessageCircle,
  CreditCard, ArrowRight, Loader2,
} from 'lucide-react'

/* ========================= Types ========================= */
interface StatusApiResponse {
  reports: Array<{
    report_id: number
    submitted_at: string | null
    full_name: string | null
    status: string
    priority: string
    category_name: string
  }>
  latest_report: { report_id: number }
  token: string
}

interface StatusApiError {
  error: string
}

/* ========================= Utilities ========================= */
const onlyDigits = (s: string | null | undefined) => (s || '').replace(/\D/g, '')

/** mask เป็นรูปแบบ 1-2345-67890-12-3 ขณะพิมพ์ */
const formatThaiIdMask = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 13)
  const p1 = d.slice(0, 1)
  const p2 = d.slice(1, 5)
  const p3 = d.slice(5, 10)
  const p4 = d.slice(10, 12)
  const p5 = d.slice(12, 13)
  return [p1, p2 && `-${p2}`, p3 && `-${p3}`, p4 && `-${p4}`, p5 && `-${p5}`]
    .filter(Boolean)
    .join('')
}

/* ========================= Page ========================= */
export default function StatusPage() {
  const router = useRouter()
  const t = useTranslations('StatusPage')

  const [idMasked, setIdMasked] = useState('')
  const [phoneLast4, setPhoneLast4] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const detectedIdType = useMemo(() => {
    if (!idMasked) return null
    const digitsOnly = onlyDigits(idMasked)
    if (digitsOnly.length === 13 && /^\d{13}$/.test(digitsOnly)) return 'thai'
    if (idMasked.length > 0) return 'foreigner'
    return null
  }, [idMasked])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!idMasked?.trim() || !phoneLast4?.trim()) {
      setError(t('err.fillAll'))
      return
    }
    if (!/^\d{4}$/.test(phoneLast4)) {
      setError(t('err.phone4'))
      return
    }
    if (!detectedIdType) {
      setError(t('err.needId'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const cleanId = onlyDigits(idMasked || '').trim()
      const cleanPhone = phoneLast4?.trim() || ''
      if (!cleanId) {
        setError(t('err.invalidId'))
        return
      }
      if (!cleanPhone || cleanPhone.length !== 4 || !/^\d{4}$/.test(cleanPhone)) {
        setError(t('err.invalidPhone'))
        return
      }

      let searchResults: StatusApiResponse | null = null
      let lastError: string | null = null

      try {
        const response1 = await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idNumber: idMasked, phoneLast4: cleanPhone }),
        })
        if (response1.ok) {
          searchResults = await response1.json()
        } else {
          const errorData: StatusApiError = await response1.json()
          lastError = errorData.error
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Network error'
      }

      if (!searchResults) {
        try {
          const response2 = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idNumber: cleanId, phoneLast4: cleanPhone }),
          })
          if (response2.ok) {
            searchResults = await response2.json()
          } else {
            const errorData: StatusApiError = await response2.json()
            lastError = errorData.error
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Network error'
        }
      }

      if (!searchResults) throw new Error(lastError || t('err.search'))

      if (!searchResults || typeof searchResults !== 'object') {
        throw new Error(t('err.badShape'))
      }
      if (!searchResults.latest_report || !searchResults.latest_report.report_id) {
        throw new Error(t('err.incomplete'))
      }
      if (!searchResults.token) {
        throw new Error(t('err.badToken'))
      }

      router.push(
        `/request/status/result?id=${searchResults.latest_report.report_id}&token=${searchResults.token}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.search'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="cctv-bg-dot min-h-screen">
      {/* Official header */}
      <div className="cctv-official">
        <div className="seal" aria-hidden />
        <div className="flex flex-col min-w-0">
          <span className="org-line1">เทศบาลนครหัวหิน · Hua Hin Municipality</span>
          <span className="org-line2">ระบบยื่นคำร้องขอภาพจากกล้อง CCTV</span>
        </div>
        <Link
          href="/request"
          className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-[color,border-color] focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
        >
          ยื่นคำร้องใหม่
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="relative mx-auto max-w-xl px-4 pt-10 sm:pt-14 pb-16 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="text-center mb-8">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)]"
            style={{ boxShadow: '0 8px 20px -8px color-mix(in oklch, var(--primary) 60%, transparent)' }}
            aria-hidden="true"
          >
            <Search className="h-6 w-6" />
          </div>
       
          <h1 className="text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight text-[var(--foreground)]">
            {t('title')}
          </h1>
          <p className="mt-1.5 text-[var(--muted-foreground)] text-sm">{t('subtitle')}</p>
        </header>

        {/* Card */}
        <div className="cctv-card-elev">
          <div
            className="cctv-card-head"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in oklch, var(--primary) 8%, transparent), transparent)',
            }}
          >
            <span className="cctv-num">1</span>
            <div>
              <div className="text-sm font-bold text-[var(--foreground)]">{t('form.title')}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{t('form.desc')}</div>
            </div>
          </div>

          <div className="cctv-card-body">
            <form onSubmit={handleSearch} className="space-y-5" noValidate>
              {/* ID Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="idNumber"
                  className="flex items-center gap-1 text-[13px] font-semibold text-[var(--foreground)]"
                >
                  {t('form.id.label')}{' '}
                  <span className="text-[var(--destructive)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cctv-fg-subtle,var(--muted-foreground))]" aria-hidden="true">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <input
                    id="idNumber"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={idMasked.length > 0 && !detectedIdType}
                    aria-describedby="idHelp"
                    placeholder={t('form.id.placeholder')}
                    value={idMasked}
                    onChange={(e) => {
                      const inputValue = e.target.value.toUpperCase()
                      const digitsOnly = onlyDigits(inputValue)
                      if (
                        digitsOnly.length <= 13 &&
                        /^[0-9\-]*$/.test(inputValue) &&
                        inputValue.length <= 17
                      ) {
                        setIdMasked(formatThaiIdMask(inputValue))
                      } else {
                        const cleanValue = inputValue.replace(
                          /[!@#$%^&*()_+\-=[\]{}|;':",./<>?\\]/g,
                          ''
                        )
                        setIdMasked(cleanValue)
                      }
                    }}
                    maxLength={17}
                    className="w-full h-12 pl-10 pr-3.5 text-[15px] font-medium border-[1.5px] border-[var(--border)] hover:border-[var(--cctv-border-strong,var(--border))] focus-visible:border-[var(--primary)] focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] focus-visible:outline-none rounded-lg bg-[var(--card)] transition-[border-color,box-shadow] aria-invalid:border-[var(--destructive)]"
                  />
                </div>
                <div id="idHelp" className="text-xs text-[var(--muted-foreground)]">
                  {detectedIdType === 'thai' && t('form.id.help.thai')}
                  {detectedIdType === 'foreigner' && t('form.id.help.foreigner')}
                  {!detectedIdType && idMasked && t('form.id.help.mixed')}
                  {!idMasked && t('form.id.help.empty')}
                </div>
              </div>

              {/* Last 4 digits */}
              <div className="space-y-1.5">
                <label
                  htmlFor="phoneLast4"
                  className="flex items-center gap-1 text-[13px] font-semibold text-[var(--foreground)]"
                >
                  {t('form.phone.label')}{' '}
                  <span className="text-[var(--destructive)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cctv-fg-subtle,var(--muted-foreground))]" aria-hidden="true">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    id="phoneLast4"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    pattern="[0-9]*"
                    aria-invalid={phoneLast4.length > 0 && !/^\d{4}$/.test(phoneLast4)}
                    aria-describedby="phoneHelp"
                    placeholder={t('form.phone.placeholder')}
                    value={phoneLast4}
                    onChange={(e) => setPhoneLast4(onlyDigits(e.target.value).slice(0, 4))}
                    maxLength={4}
                    className="w-full h-12 pl-10 pr-3.5 text-[15px] font-medium border-[1.5px] border-[var(--border)] hover:border-[var(--cctv-border-strong,var(--border))] focus-visible:border-[var(--primary)] focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] focus-visible:outline-none rounded-lg bg-[var(--card)] cctv-tabular transition-[border-color,box-shadow] aria-invalid:border-[var(--destructive)]"
                  />
                </div>
                <div id="phoneHelp" className="text-xs text-[var(--muted-foreground)]">
                  {t('form.phone.help')}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border p-3.5 text-sm flex items-start gap-2"
                  style={{
                    borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)',
                    backgroundColor: 'color-mix(in oklch, var(--destructive) 8%, transparent)',
                    color: 'var(--destructive)',
                  }}
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-lg inline-flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] text-base font-semibold transition-[background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  boxShadow:
                    '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px -6px color-mix(in oklch, var(--primary) 60%, transparent)',
                  touchAction: 'manipulation',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    {t('form.submit.loading')}
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" aria-hidden="true" />
                    {t('form.submit.label')}
                  </>
                )}
              </button>

              {/* aria-live */}
              <div className="sr-only" aria-live="polite">
                {isLoading ? t('live.loading') : ''}
              </div>
            </form>
          </div>
        </div>

        {/* Contact strip — design-style 2-column grid */}
        <div className="mt-6 cctv-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-[var(--primary)] mt-0.5" aria-hidden="true">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-[var(--foreground)]">{t('contact.hours')}</div>
              <div className="cctv-subtle">{t('contact.hoursFull')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[var(--primary)] mt-0.5" aria-hidden="true">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-[var(--foreground)]">{t('contact.phoneLabel')}</div>
              <a
                href="tel:032511047"
                className="cctv-subtle text-[var(--primary)] underline underline-offset-4 hover:opacity-80 cctv-tabular"
                translate="no"
              >
                032-511-047 ต่อ 310
              </a>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[var(--primary)] mt-0.5" aria-hidden="true">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-[var(--foreground)]">{t('contact.place')}</div>
              <address className="not-italic cctv-subtle">
                {t('contact.center')} {t('contact.floor')}
              </address>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[var(--primary)] mt-0.5" aria-hidden="true">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-[var(--foreground)]">Line Official</div>
              <a
                href="https://line.me/R/ti/p/@513dlddc"
                target="_blank"
                rel="noopener noreferrer"
                className="cctv-subtle text-[var(--primary)] underline underline-offset-4 hover:opacity-80"
                translate="no"
              >
                @513dlddc
              </a>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--cctv-bg-muted,var(--muted))] text-xs text-[var(--muted-foreground)] leading-relaxed">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t('pdpa')}</span>
        </div>
      </div>
    </main>
  )
}
