'use client'

import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  MessageCircle,
  ArrowLeft,
  ScanLine,
  ShieldCheck,
  Clock4,
  Phone,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Suspense } from 'react'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from 'next-intl'

/* ============================================================
   QR Hero — viewfinder-style with animated corner brackets
   ============================================================ */
function QRViewfinder({
  value,
  src,
  alt,
  size,
}: {
  value?: string
  src?: string
  alt?: string
  size: number
}) {
  const PADDING = 16
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(15,23,42,0.16)] ring-1 ring-border"
      style={{ width: size + PADDING * 2, height: size + PADDING * 2 }}
    >
      {/* corner brackets */}
      <span aria-hidden className="pointer-events-none absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-[var(--primary)] rounded-tl" />
      <span aria-hidden className="pointer-events-none absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-[var(--primary)] rounded-tr" />
      <span aria-hidden className="pointer-events-none absolute left-2 bottom-2 h-5 w-5 border-l-2 border-b-2 border-[var(--primary)] rounded-bl" />
      <span aria-hidden className="pointer-events-none absolute right-2 bottom-2 h-5 w-5 border-r-2 border-b-2 border-[var(--primary)] rounded-br" />

      {/* scan line — respect reduced motion */}
      <span
        aria-hidden
        className="qr-scan-line pointer-events-none absolute inset-x-6 top-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--primary)]/70 to-transparent motion-reduce:hidden"
      />

      {value ? (
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#142d4f"
          aria-label={alt || 'QR Code สำหรับผูกคำร้องกับ LINE'}
        />
      ) : (
        <Image
          src={src!}
          alt={alt || 'LINE QR Code'}
          width={size}
          height={size}
          priority
          className="rounded-md"
        />
      )}

      <style jsx>{`
        .qr-scan-line {
          --scan-distance: ${size - 16}px;
          animation: qr-scan 2.6s ease-in-out infinite;
        }
        @keyframes qr-scan {
          0%   { transform: translateY(0);                      opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(var(--scan-distance));   opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-scan-line { animation: none; }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   Step row — numbered chip + label
   ============================================================ */
function Step({
  n,
  title,
  desc,
}: {
  n: number
  title: string
  desc?: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
    </li>
  )
}

/* ============================================================
   Benefit row — icon + text
   ============================================================ */
function Benefit({
  icon: Icon,
  text,
}: {
  icon: typeof ShieldCheck
  text: string
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/15">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="text-[13px] leading-relaxed text-foreground/80">{text}</span>
    </li>
  )
}

/* ============================================================
   Main content
   ============================================================ */
function SuccessContent() {
  const searchParams = useSearchParams()
  const t = useTranslations('success')
  const reportId = searchParams.get('id') || t('unknownReportId')
  const trackingToken = searchParams.get('token')

  const liffId =
    process.env.NEXT_PUBLIC_LINE_LIFF_ONSITE_ID ||
    process.env.NEXT_PUBLIC_LINE_LIFF_ID ||
    process.env.NEXT_PUBLIC_LIFF_ID ||
    ''
  const canAutoLink =
    Boolean(trackingToken && liffId && reportId !== t('unknownReportId'))

  // Query-based deep link — เสถียรกว่า path-based บน iOS Safari/Android Chrome
  const liffAutoLinkUrl = canAutoLink
    ? `https://liff.line.me/${liffId}?reportId=${encodeURIComponent(String(reportId))}&token=${encodeURIComponent(String(trackingToken))}`
    : ''

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Atmospheric background — dot grid + soft radial accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          [background-image:radial-gradient(color-mix(in_oklab,var(--primary)_14%,transparent)_1px,transparent_1px)]
          [background-size:18px_18px] [background-position:0_0]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          bg-[radial-gradient(circle_700px_at_15%_-5%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_60%),
              radial-gradient(circle_700px_at_85%_110%,color-mix(in_oklab,var(--accent-foreground)_8%,transparent),transparent_60%)]"
      />

      {/* Top success ribbon — full-bleed accent strip */}
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--primary)] via-[var(--success)] to-[var(--primary)]" />
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-14 md:pt-20 pb-16">
        {/* ─── Hero block: success state ─────────────────────────── */}
        <header className="mx-auto mb-8 md:mb-12 max-w-3xl text-center">
         

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {t('subtitle')}
          </p>

         
        </header>

        {/* ─── Two-column section: QR (left) | Info (right) ──────── */}
        <section
          aria-labelledby="line-section"
          className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10 lg:gap-14 items-stretch"
        >
          {/* QR card */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm flex flex-col items-center text-center">
            {/* Header tag */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <ScanLine className="h-3 w-3" />
              สแกนเพื่อเชื่อมคำร้อง
            </div>

            <h2 id="line-section" className="mb-1 text-lg font-bold text-foreground md:text-xl">
              {t('lineTitle')}
            </h2>
            <p className="mb-6 text-xs text-muted-foreground md:text-sm">
              {t('lineAccountName')}
            </p>

            {/* QR */}
            <div className="mb-5">
              {canAutoLink ? (
                <QRViewfinder
                  value={liffAutoLinkUrl}
                  alt={`QR Code ผูกคำร้อง #${reportId}`}
                  size={224}
                />
              ) : (
                <QRViewfinder
                  src="/qrcode/M_513dlddc_BW.png"
                  alt="LINE QR Code"
                  size={224}
                />
              )}
            </div>

            {canAutoLink ? (
              <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                ผูกคำร้องอัตโนมัติเมื่อสแกน
              </p>
            ) : (
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                สแกนเพื่อเพิ่มเพื่อน LINE OA
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70">
              ใช้กล้องในแอป LINE หรือกล้องของมือถือ
            </p>

            {/* Manual fallback button — only shown on small screens (mobile direct user) */}
            {trackingToken ? (
              <Link
                href={`/liff-onsite/dispatch?reportId=${reportId}&token=${trackingToken}`}
                className="mt-5 w-full md:hidden"
              >
                <Button className="h-11 w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.99] transition">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {t('addLineFriend')}
                </Button>
              </Link>
            ) : null}
          </div>

          {/* Info card — steps + benefits */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm flex flex-col">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                สำหรับผู้ยื่นคำร้อง
              </span>
              <h3 className="mt-2 text-lg font-bold text-foreground md:text-xl">
                ขั้นตอนการสแกน QR Code
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t('scanQrDescription')}
              </p>
            </div>

            <ol className="mt-6 space-y-4">
              <Step
                n={1}
                title="เปิดแอป LINE บนมือถือของผู้ยื่น"
                desc="แตะแถบค้นหา จากนั้นเลือกไอคอน QR Code Scanner"
              />
              <Step
                n={2}
                title="สแกน QR ที่หน้าจอนี้"
                desc="ระบบจะเปิดหน้าผูกคำร้องอัตโนมัติ"
              />
              <Step
                n={3}
                title="กดยืนยันเพื่อรับการแจ้งเตือน"
                desc={t('connectNotification')}
              />
            </ol>

            {/* Benefits */}
            <div className="mt-7 rounded-xl bg-muted p-4 ring-1 ring-border">
              <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/75">
                <Sparkles className="h-3 w-3 text-primary" />
                {t('benefitsTitle')}
              </p>
              <ul className="space-y-2.5">
                <Benefit icon={ShieldCheck} text={t('benefit1')} />
                <Benefit icon={Clock4} text={t('benefit2')} />
                <Benefit icon={MessageCircle} text={t('benefit3')} />
              </ul>
            </div>

            {/* Action footer (desktop primary placement) */}
            <div className="mt-auto pt-6">
              {trackingToken ? (
                <Link
                  href={`/liff-onsite/dispatch?reportId=${reportId}&token=${trackingToken}`}
                  className="block w-full"
                >
                  <Button
                    variant="outline"
                    className="hidden md:flex h-11 w-full border-border bg-card text-foreground hover:bg-accent active:scale-[0.99] transition"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    หรือกดเพื่อเปิดในมือถือเครื่องนี้
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {/* ─── Bottom row: action + footer note ──────────────────── */}
        <section className="mt-10 md:mt-14 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Phone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  ติดต่อสอบถาม
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                  {t('footerNote')}
                </p>
              </div>
            </div>
          </div>

          <Link href="/request-onsite" className="block md:w-auto">
            <Button
              variant="outline"
              className="h-11 w-full md:w-auto md:px-6 border-border bg-card text-foreground hover:bg-accent active:scale-[0.99] transition"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('newRequest')}
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}

/* ============================================================
   Suspense fallback
   ============================================================ */
function LoadingFallback() {
  const t = useTranslations('success')
  return (
    <div className="relative min-h-dvh bg-background">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--primary)] via-[var(--success)] to-[var(--primary)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          [background-image:radial-gradient(color-mix(in_oklab,var(--primary)_14%,transparent)_1px,transparent_1px)]
          [background-size:18px_18px]"
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--primary)]" />
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccessContent />
    </Suspense>
  )
}
