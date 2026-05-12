'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PDPA_CONSENT_TYPES,
  PDPA_PRIVACY_NOTICE_VERSION,
} from '@/lib/pdpa'

interface PDPAConsentModalProps {
  isOpen: boolean
  onAccept: () => void
  onReject: () => void
  /**
   * LINE userId (ถ้าผู้ใช้ login ผ่าน LIFF แล้ว) — จะถูกบันทึกใน consent log
   * เพื่อใช้พิสูจน์ว่าผู้ใช้รายใดให้ความยินยอม
   */
  lineUserIdStr?: string | null
  /**
   * path ที่แสดง consent (default = window.location.pathname)
   */
  pagePath?: string
}

type SectionId = 'data' | 'purpose' | 'retention' | 'rights'

interface SectionConfig {
  id: SectionId
  icon: LucideIcon
  title: string
  subtitle: string
}

const SECTIONS: readonly SectionConfig[] = [
  {
    id: 'data',
    icon: Database,
    title: 'ข้อมูลที่จัดเก็บ',
    subtitle: 'ข้อมูลที่ท่านกรอกในแบบฟอร์ม',
  },
  {
    id: 'purpose',
    icon: Target,
    title: 'วัตถุประสงค์การใช้ข้อมูล',
    subtitle: 'เฉพาะเพื่อพิจารณาคำร้องของท่าน',
  },
  {
    id: 'retention',
    icon: Clock,
    title: 'ระยะเวลาเก็บข้อมูล',
    subtitle: 'เก็บเท่าที่จำเป็น แล้วทำลายอย่างปลอดภัย',
  },
  {
    id: 'rights',
    icon: ShieldCheck,
    title: 'สิทธิของท่านตามกฎหมาย',
    subtitle: 'ใช้สิทธิได้ตลอดเวลา',
  },
]

interface DataTagItem {
  icon: LucideIcon
  label: string
}
const DATA_TAGS: readonly DataTagItem[] = [
  { icon: User, label: 'ชื่อ-นามสกุล' },
  { icon: Calendar, label: 'อายุ' },
  { icon: MapPin, label: 'ที่อยู่' },
  { icon: Phone, label: 'เบอร์โทรศัพท์' },
  { icon: CreditCard, label: 'เลขบัตร ปชช. / Passport' },
  { icon: FileText, label: 'รายละเอียดเหตุการณ์' },
  { icon: Paperclip, label: 'เอกสารแนบและภาพถ่ายใบหน้ายืนยันตัวตน' },
  { icon: Database, label: 'LINE user ID และสถานะเป็นเพื่อน LINE OA' },
]

const PURPOSE_ITEMS = [
  'ตรวจสอบและยืนยันตัวตนของผู้ยื่นคำร้อง',
  'ค้นหาภาพจากกล้อง CCTV ตามวัน เวลา และสถานที่ที่ระบุ',
  'ติดต่อกลับเพื่อแจ้งสถานะหรือขอข้อมูลเพิ่มเติม',
  'ส่งมอบไฟล์ภาพ/วิดีโอเมื่อได้รับการอนุมัติ',
  'เชื่อมคำร้องกับ LINE / LIFF และตรวจสอบสถานะการเป็นเพื่อนกับ LINE OA',
] as const

interface RetentionBox {
  num: string
  unit: string
  desc: string
}
const RETENTION_BOXES: readonly RetentionBox[] = [
  { num: '7', unit: 'ปี', desc: 'ข้อมูลคำร้อง เอกสารแนบ และหลักฐานการยินยอม นับจากวันสิ้นสุดคำร้อง' },
  { num: '30', unit: 'วัน', desc: 'ภาพ CCTV ย้อนหลัง ตามมาตรฐานความจุของระบบ' },
  { num: '24', unit: 'ชม.', desc: 'token หรือลิงก์ชั่วคราวสำหรับแจ้งผลผ่าน LINE' },
]

interface RightItem {
  icon: LucideIcon
  label: string
  desc: string
}
const RIGHTS: readonly RightItem[] = [
  { icon: Search, label: 'สิทธิเข้าถึง', desc: 'ขอดูข้อมูลที่จัดเก็บได้' },
  { icon: Pencil, label: 'สิทธิแก้ไข', desc: 'ขอแก้ไขให้ถูกต้อง' },
  { icon: Trash2, label: 'สิทธิลบ', desc: 'ขอให้ลบข้อมูลได้' },
  { icon: Ban, label: 'สิทธิคัดค้านและระงับใช้', desc: 'ใช้ได้ตามเงื่อนไขที่กฎหมายกำหนด' },
  { icon: ShieldCheck, label: 'สิทธิถอนความยินยอม', desc: 'ถอนความยินยอมในส่วนที่อาศัย consent ได้' },
  { icon: FileText, label: 'สิทธิร้องเรียน', desc: 'ร้องเรียนต่อ สคส. ได้เมื่อเห็นว่าข้อมูลถูกใช้ไม่ชอบ' },
]

const DIALOG_STYLE: CSSProperties = { touchAction: 'manipulation' }
const DEFAULT_OPEN: ReadonlySet<SectionId> = new Set<SectionId>()

// Hero gradient — radial primary glow + soft surface fade
const HERO_BG_STYLE: CSSProperties = {
  backgroundImage: [
    'radial-gradient(360px 200px at 88% 0%, color-mix(in oklch, var(--primary) 22%, transparent) 0%, transparent 70%)',
    'linear-gradient(180deg, color-mix(in oklch, var(--primary) 4%, var(--card)) 0%, var(--card) 100%)',
  ].join(', '),
}

// Heading gradient text — primary → violet
const ACCENT_TEXT_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, var(--primary), #2d5798)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

// Success-soft tint for rights icons
const RIGHT_ICON_STYLE: CSSProperties = {
  backgroundColor: 'color-mix(in oklch, var(--success) 14%, var(--card))',
  color: 'var(--success)',
}

const HINT_OK_STYLE: CSSProperties = { color: 'var(--success)' }

// Consent gradient card
const CONSENT_BG_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, var(--muted) 0%, color-mix(in oklch, var(--primary) 5%, var(--card)) 100%)',
}

// Primary button glow shadow
const PRIMARY_SHADOW: CSSProperties = {
  boxShadow: '0 6px 18px -8px color-mix(in oklch, var(--primary) 60%, transparent)',
}

export default function PDPAConsentModal({
  isOpen,
  onAccept,
  onReject,
  lineUserIdStr,
  pagePath,
}: PDPAConsentModalProps) {
  const [consented, setConsented] = useState(false)
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    () => new Set(DEFAULT_OPEN),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // กัน duplicate logging: ถ้าผู้ใช้กด accept→reject เร็ว ๆ ไม่ควรยิง 2 ครั้ง
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setConsented(false)
      setOpenSections(new Set(DEFAULT_OPEN))
      setSubmitError(null)
      setSubmitting(false)
      inFlightRef.current = false
    }
  }, [isOpen])

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleConsent = useCallback(() => setConsented((v) => !v), [])

  const logConsent = useCallback(
    async (action: 'accepted' | 'rejected'): Promise<boolean> => {
      try {
        const res = await fetch('/api/consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action,
            consent_type: PDPA_CONSENT_TYPES.PRIVACY_NOTICE,
            policy_version: PDPA_PRIVACY_NOTICE_VERSION,
            line_user_id_str: lineUserIdStr ?? null,
            page_path:
              pagePath ??
              (typeof window !== 'undefined' ? window.location.pathname : null),
            locale:
              typeof document !== 'undefined'
                ? document.documentElement.lang || null
                : null,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || `HTTP_${res.status}`)
        }
        return true
      } catch (err) {
        console.error('[PDPA] consent log failed:', err)
        return false
      }
    },
    [lineUserIdStr, pagePath],
  )

  const handleAccept = useCallback(async () => {
    if (!consented || submitting || inFlightRef.current) return
    inFlightRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    const ok = await logConsent('accepted')
    setSubmitting(false)
    inFlightRef.current = false
    if (!ok) {
      // PDPA ต้องเก็บหลักฐาน — ถ้าบันทึกไม่ได้ อย่าให้ผ่าน
      setSubmitError(
        'ไม่สามารถบันทึกความยินยอมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      )
      return
    }
    onAccept()
  }, [consented, logConsent, onAccept, submitting])

  const handleReject = useCallback(() => {
    // fire-and-forget — user ไม่ต้องรอ ก็ปิด modal ได้เลย
    void logConsent('rejected')
    onReject()
  }, [logConsent, onReject])

  // ปิด modal ผ่านปุ่ม "ไม่ยินยอม" หรือ "ยินยอมและดำเนินการต่อ" เท่านั้น
  // ไม่ trigger reject จาก Radix's onOpenChange เพราะอาจถูกเรียกตอน unmount
  // หรือ state transition ที่ไม่ใช่ user intent → ทำให้ pdpaAccepted ลูปกลับเป็น false
  const handleOpenChange = useCallback(() => {
    /* no-op */
  }, [])

  const preventDismiss = useCallback((event: Event) => {
    event.preventDefault()
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby="pdpa-summary"
        onEscapeKeyDown={preventDismiss}
        onInteractOutside={preventDismiss}
        style={DIALOG_STYLE}
        className="flex max-h-[92dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-xl sm:max-h-[90dvh] sm:max-w-[640px] sm:rounded-3xl"
      >
        {/* ===== Hero ===== */}
        <header
          style={HERO_BG_STYLE}
          className="flex-none border-b border-border px-5 pt-6 pb-5 sm:px-8 sm:pt-7 sm:pb-6"
        >
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_120px] sm:gap-5">
            {/* Illustration: order-first on mobile (top), order-last on desktop (right) */}
            <div className="order-first mx-auto h-24 w-24 sm:order-last sm:mx-0 sm:h-[120px] sm:w-[120px]">
              <HeroShieldIllustration />
            </div>

            {/* Content */}
            <div className="order-last text-center sm:order-first sm:text-left">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.08] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[color:var(--accent-foreground)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                ก่อนเริ่มยื่นคำร้อง
              </span>

              <DialogTitle className="mt-3 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
                {' '}
                <span style={ACCENT_TEXT_STYLE}>การคุ้มครองข้อมูลส่วนบุคคล</span>
              </DialogTitle>

              <DialogDescription
                id="pdpa-summary"
                className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground sm:text-sm"
              >
                เทศบาลนครหัวหินจะเก็บและใช้ข้อมูลของท่าน รวมถึงข้อมูล LINE
                เท่าที่จำเป็นต่อการรับ แจ้งผลคำร้องขอภาพจากกล้อง CCTV
              </DialogDescription>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-foreground shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                </span>
                <Link
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  อ่านประกาศฉบับเต็ม
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ===== Body (scrollable) ===== */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card px-2 sm:px-3">
          <ul className="m-0 list-none p-0">
            {SECTIONS.map((section, idx) => (
              <AccordionSection
                key={section.id}
                config={section}
                isOpen={openSections.has(section.id)}
                onToggle={toggleSection}
                isLast={idx === SECTIONS.length - 1}
              >
                <SectionBody id={section.id} />
              </AccordionSection>
            ))}
          </ul>
        </div>

        {/* ===== Consent card ===== */}
        <button
          type="button"
          onClick={toggleConsent}
          aria-pressed={consented}
          style={CONSENT_BG_STYLE}
          className={cn(
            'mx-3 mt-1 mb-3 flex flex-none items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors sm:mx-4 sm:mb-4 sm:px-[18px] sm:py-4',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            consented ? 'border-primary/45' : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border-2 bg-card transition-colors',
              consented
                ? 'border-primary bg-primary'
                : 'border-border hover:border-muted-foreground',
            )}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 stroke-[3.5] text-primary-foreground transition-opacity',
                consented ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
          <span className="flex-1 text-[13.5px] leading-relaxed text-foreground sm:text-sm">
            ข้าพเจ้า{' '}
            <strong
              className="font-bold"
              style={{ color: 'var(--accent-foreground)' }}
            >
              รับทราบและยินยอม
            </strong>
            {' '}ให้เทศบาลนครหัวหินเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามฐานกฎหมาย
            และวัตถุประสงค์ที่ระบุไว้ในประกาศฉบับนี้
           
          </span>
        </button>

        {/* ===== Actions ===== */}
        <div className="flex flex-none flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3.5 sm:gap-3 sm:px-6 sm:py-4">
          <span
            aria-live="polite"
            className={cn(
              'flex w-full items-center gap-2 text-[13px] sm:mr-auto sm:w-auto',
              !consented && 'text-muted-foreground',
            )}
            style={
              submitError
                ? { color: 'var(--destructive)' }
                : consented
                  ? HINT_OK_STYLE
                  : undefined
            }
          >
            {submitError ? (
              <>
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {submitError}
              </>
            ) : (
              <>
                <Info className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                {consented
                  ? 'พร้อมดำเนินการต่อ'
                  : 'กรุณายืนยันความยินยอมก่อนดำเนินการต่อ'}
              </>
            )}
          </span>

          <Button
            type="button"
            variant="outline"
            onClick={handleReject}
            disabled={submitting}
            className="h-11 flex-1 rounded-xl px-5 text-[14px] font-semibold sm:flex-initial"
          >
            ไม่ยินยอม
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!consented || submitting}
            style={consented && !submitting ? PRIMARY_SHADOW : undefined}
            className="h-11 flex-1 rounded-xl px-5 text-[14px] font-semibold sm:flex-initial"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                ยินยอมและดำเนินการต่อ
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
 * Accordion item
 * ============================================================ */
function AccordionSection({
  config,
  isOpen,
  onToggle,
  isLast,
  children,
}: {
  config: SectionConfig
  isOpen: boolean
  onToggle: (id: SectionId) => void
  isLast: boolean
  children: ReactNode
}) {
  const { id, icon: Icon, title, subtitle } = config
  const triggerId = `pdpa-trigger-${id}`
  const contentId = `pdpa-content-${id}`

  return (
    <li className={cn('list-none', !isLast && 'border-b border-border')}>
      <button
        id={triggerId}
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="grid w-full grid-cols-[40px_1fr_24px] items-center gap-3 rounded-xl px-4 py-4 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-3.5 sm:px-5"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-tight text-foreground sm:text-base">
            {title}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground/80">
            {subtitle}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 justify-self-end text-muted-foreground/80 motion-safe:transition-transform motion-safe:duration-200',
            isOpen && 'rotate-180 text-primary',
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          {/* Mobile: full-width content (เก็บพื้นที่ให้ data tags กว้างพอ); Desktop: indent ใต้ icon column ตาม design */}
          <div className="pb-5 pl-4 pr-4 sm:pl-[72px] sm:pr-6">
            {children}
          </div>
        </div>
      </div>
    </li>
  )
}

/* ============================================================
 * Section bodies
 * ============================================================ */
function SectionBody({ id }: { id: SectionId }) {
  if (id === 'data') {
    return (
      <div className="flex flex-wrap gap-2">
        {DATA_TAGS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[12.5px] font-medium text-foreground"
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    )
  }

  if (id === 'purpose') {
    return (
      <ul className="m-0 grid list-none gap-2 p-0 text-[13.5px] leading-relaxed text-muted-foreground sm:text-sm">
        {PURPOSE_ITEMS.map((item) => (
          <li key={item} className="grid grid-cols-[14px_1fr] items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 rounded-full bg-primary"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (id === 'retention') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RETENTION_BOXES.map((box) => (
          <div
            key={`${box.num}-${box.unit}-${box.desc}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="text-[28px] font-bold leading-none tracking-tight text-primary">
              {box.num}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                {box.unit}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {box.desc}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // rights
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {RIGHTS.map(({ icon: Icon, label, desc }) => (
        <div
          key={label}
          className="grid grid-cols-[28px_1fr] items-start gap-2.5 rounded-[10px] px-2.5 py-2"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={RIGHT_ICON_STYLE}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">
              {label}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {desc}
            </div>
          </div>
        </div>
      ))}

      <div className="col-span-full mt-1 text-[12px] text-muted-foreground">
        ติดต่อ เทศบาลนครหัวหิน{' '}
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          0-3251-1047 ต่อ 310
        </span>
      </div>
    </div>
  )
}

/* ============================================================
 * Hero illustration — shield + lock + check
 * ============================================================ */
function HeroShieldIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pdpa-shield-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#002366" />
          <stop offset="1" stopColor="#123e86" />
        </linearGradient>
        <linearGradient id="pdpa-bg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef4fc" />
          <stop offset="1" stopColor="#dce7f7" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="68" fill="url(#pdpa-bg-grad)" />
      <circle cx="128" cy="42" r="6" fill="#002366" opacity="0.25" />
      <circle cx="32" cy="118" r="4" fill="#002366" opacity="0.3" />
      {/* Shield */}
      <path
        d="M80 32 L 116 44 L 116 86 C 116 110 96 124 80 130 C 64 124 44 110 44 86 L 44 44 Z"
        fill="url(#pdpa-shield-grad)"
      />
      <path
        d="M80 38 L 110 48 L 110 84 C 110 104 94 118 80 124 C 66 118 50 104 50 84 L 50 48 Z"
        fill="#2d5798"
        opacity="0.5"
      />
      {/* Lock */}
      <rect x="68" y="78" width="24" height="22" rx="3" fill="#fff" />
      <path
        d="M73 78 L 73 70 C 73 65 76 62 80 62 C 84 62 87 65 87 70 L 87 78"
        stroke="#fff"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="80" cy="87" r="2.5" fill="#002366" />
      <line
        x1="80"
        y1="87"
        x2="80"
        y2="93"
        stroke="#002366"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Check ribbon */}
      <circle cx="118" cy="108" r="14" fill="oklch(0.52 0.12 142)" />
      <path
        d="M112 108 l 4 4 l 8 -8"
        stroke="#fff"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
