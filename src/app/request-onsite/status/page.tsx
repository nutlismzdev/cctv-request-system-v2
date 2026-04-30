// src/app/request/status/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, AlertCircle, Info, Clock, MapPin, Phone, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { THEME_COLORS } from '@/lib/theme-colors'

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
  latest_report: {
    report_id: number
  }
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

/* ========================= Inline Alert ========================= */
const Alert = ({ variant = 'default', children }: { variant?: 'default' | 'destructive', children: React.ReactNode }) => (
  <div
    role={variant === 'destructive' ? 'alert' : 'status'}
    className={`p-3.5 rounded-lg border text-sm flex items-start gap-2 ${
      variant === 'destructive'
        ? `${THEME_COLORS.destructive}/15 border-[var(--destructive)]/40 text-[var(--destructive)]`
        : `${THEME_COLORS.success}/15 border-[var(--success)]/40 text-[var(--success)]`
    }`}
  >
    {children}
  </div>
)

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
          body: JSON.stringify({ idNumber: idMasked, phoneLast4: cleanPhone })
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
            body: JSON.stringify({ idNumber: cleanId, phoneLast4: cleanPhone })
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

      router.push(`/request-onsite/status/result?id=${searchResults.latest_report.report_id}&token=${searchResults.token}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.search'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* BG */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          [background-image:radial-gradient(rgba(148,163,184,0.15)_1px,transparent_1px)]
          [background-size:14px_14px] [background-position:0_0]"
      />

      <div className="relative mx-auto max-w-xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center mb-6">
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${THEME_COLORS.primary} shadow-sm`}>
            <Search className={`h-6 w-6 ${THEME_COLORS.primaryForeground}`} />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${THEME_COLORS.foreground} tracking-tight`}>
            {t('title')}
          </h1>
          <p className={`mt-1.5 ${THEME_COLORS.mutedForeground}`}>
            {t('subtitle')}
          </p>
        </header>

        {/* Step line */}
        <div className="mx-auto mb-5 max-w-xl">
          <div className={`h-1 ${THEME_COLORS.border} rounded-full`}>
            <div className={`h-1 w-1/3 ${THEME_COLORS.primary} rounded-full`} />
          </div>
          <p className={`mt-2 text-[13px] ${THEME_COLORS.mutedForeground} text-center`}>
            {t('step')}
          </p>
        </div>

        {/* Card */}
        <Card className={`${THEME_COLORS.card} border-2 ${THEME_COLORS.border} rounded-xl shadow-sm`}>
          <CardHeader className={`${THEME_COLORS.muted}/80 border-b ${THEME_COLORS.border} rounded-t-xl`}>
            <CardTitle className={`${THEME_COLORS.foreground} font-bold text-base inline-flex items-center gap-2`}>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${THEME_COLORS.primary} ${THEME_COLORS.primaryForeground} text-[11px] font-bold`}>1</span>
              {t('form.title')}
            </CardTitle>
            <CardDescription className={`${THEME_COLORS.mutedForeground}`}>
              {t('form.desc')}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5">
            <form onSubmit={handleSearch} className="space-y-5" aria-describedby="formNote" noValidate>
              {/* ID Input */}
              <div className="space-y-1.5">
                <Label htmlFor="idNumber" className={`${THEME_COLORS.foreground} font-medium`}>
                  {t('form.id.label')} <span className={`${THEME_COLORS.destructive}`}>*</span>
                </Label>
                <Input
                  id="idNumber"
                  type="text"
                  inputMode="text"
                  aria-invalid={idMasked.length > 0 && !detectedIdType}
                  aria-describedby="idHelp"
                  placeholder={t('form.id.placeholder')}
                  value={idMasked}
                  onChange={(e) => {
                    const inputValue = e.target.value.toUpperCase()
                    const digitsOnly = onlyDigits(inputValue)
                    if (digitsOnly.length <= 13 && /^[0-9\-]*$/.test(inputValue) && inputValue.length <= 17) {
                      setIdMasked(formatThaiIdMask(inputValue))
                    } else {
                      const cleanValue = inputValue.replace(/[!@#$%^&*()_+\-=[\]{}|;':",./<>?\\]/g, '')
                      setIdMasked(cleanValue)
                    }
                  }}
                  className={`h-12 text-base font-medium border-2 ${THEME_COLORS.border} focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/60 aria-invalid:border-destructive aria-invalid:border-dotted aria-invalid:ring-destructive/40`}
                  maxLength={17}
                />
                <div id="idHelp" className={`text-[13px] ${THEME_COLORS.mutedForeground}`}>
                  {detectedIdType === 'thai' && t('form.id.help.thai')}
                  {detectedIdType === 'foreigner' && t('form.id.help.foreigner')}
                  {!detectedIdType && idMasked && t('form.id.help.mixed')}
                  {!idMasked && t('form.id.help.empty')}
                </div>
              </div>

              {/* Last 4 digits */}
              <div className="space-y-1.5">
                <Label htmlFor="phoneLast4" className={`${THEME_COLORS.foreground} font-medium`}>
                  {t('form.phone.label')} <span className={`${THEME_COLORS.destructive}`}>*</span>
                </Label>
                <Input
                  id="phoneLast4"
                  type="text"
                  inputMode="numeric"
                  aria-invalid={phoneLast4.length > 0 && !/^\d{4}$/.test(phoneLast4)}
                  aria-describedby="phoneHelp"
                  placeholder={t('form.phone.placeholder')}
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(onlyDigits(e.target.value).slice(0, 4))}
                  className={`h-12 text-base font-medium border-2 ${THEME_COLORS.border} focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/60 aria-invalid:border-destructive aria-invalid:border-dotted aria-invalid:ring-destructive/40`}
                  maxLength={4}
                />
                <div id="phoneHelp" className={`text-[13px] ${THEME_COLORS.mutedForeground}`}>
                  {t('form.phone.help')}
                </div>
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{error}</span>
                </Alert>
              )}

              {/* Submit */}
              <div className={`pt-3 border-t ${THEME_COLORS.border}`}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-12 text-base font-semibold ${THEME_COLORS.primary} ${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground} border ${THEME_COLORS.primary} rounded-lg shadow-sm hover:shadow transition`}
                >
                  {isLoading ? t('form.submit.loading') : t('form.submit.label')}
                  <Search className="w-5 h-5 ml-2" />
                </Button>
               
              </div>

              {/* aria-live */}
              <div className="sr-only" aria-live="polite">
                {isLoading ? t('live.loading') : ''}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer note/Contact */}
        <div className={`mt-6 sm:mt-8 border-t pt-4 sm:pt-5 ${THEME_COLORS.border}`} aria-label={t('contact.aria')}>
          {/* Mobile */}
          <div className="block sm:hidden px-2">
            <div className="space-y-4">
              <h3 className={`font-medium ${THEME_COLORS.foreground} text-[15px] text-center`}>{t('contact.title')}</h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                  <div className="text-[14px] leading-relaxed">
                    <div className="font-medium mb-1">{t('contact.hours')}</div>
                    <div className="space-y-1 text-[var(--primary)]">
                      <div>{t('contact.weekday')}</div>
                      <div>{t('contact.weekend')}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                  <div className="text-[14px] leading-relaxed">
                    <div className="font-medium mb-1">{t('contact.place')}</div>
                    <address className="not-italic text-[var(--primary)]">
                      <span className="block sm:inline">{t('contact.center')}</span>
                      <span className="block sm:inline sm:ml-1">{t('contact.floor')}</span>
                    </address>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                  <div className="text-[14px] leading-relaxed">
                    <div className="font-medium mb-1">{t('contact.phoneLabel')}</div>
                    <a href="tel:032511047" className={`text-[var(--primary)] underline underline-offset-4 hover:text-[var(--primary)]/80`}>
                      032-511-047 ต่อ 310
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                  <div className="text-[14px] leading-relaxed">
                    <div className="font-medium mb-1">Line Official</div>
                    <a
                      href="https://line.me/R/ti/p/@513dlddc"
                      target="_blank"
                      rel="noopener"
                      className={`text-[var(--primary)] underline underline-offset-4 hover:text-[var(--primary)]/80`}
                    >
                      @513dlddc
                    </a>
                  </div>
                </div>
              </div>

              <div className="text-center text-[13px] text-muted-foreground opacity-80 mt-4 p-3 bg-muted/50 rounded-lg">
                <Info className="w-4 h-4 inline mr-2" />
                {t('pdpa')}
              </div>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden sm:block">
            <div className="text-center text-[13px] leading-relaxed space-y-1.5">
              <p className={`font-medium ${THEME_COLORS.foreground}/90 text-base`}>{t('contact.title')}</p>

              <p className="inline-flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                <span>{t('contact.hoursFull')}</span>
              </p>

              <address className="not-italic flex flex-col sm:flex-row sm:items-center justify-center gap-1 sm:gap-2 text-center sm:text-left">
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                  <span className="text-sm">{t('contact.center')}</span>
                </div>
                <span className="text-sm text-gray-600">{t('contact.floor')}</span>
              </address>

              <p className="inline-flex items-center justify-center gap-2">
                <Phone className="w-4 h-4 text-[var(--primary)]" />
                <span>
                  {t('contact.phoneShort')}{' '}
                  <a href="tel:032511047" className="underline underline-offset-4 text-[var(--primary)] hover:text-[var(--primary)]/80">
                    032-511-047
                  </a>{' '}
                  {t('contact.ext')} 310
                </span>
              </p>

              <p className="inline-flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4 text-[var(--primary)]" />
                <span>Line Official: <a href="https://line.me/R/ti/p/@513dlddc" target="_blank" rel="noopener" className="underline underline-offset-4 text-[var(--primary)] hover:text-[var(--primary)]/80">@513dlddc</a></span>
              </p>

              <p className="inline-flex items-center justify-center gap-2 text-[12px] opacity-80">
                <Info className="w-4 h-4" />
                <span>{t('pdpa')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
