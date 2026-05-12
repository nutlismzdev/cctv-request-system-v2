// app/privacy-policy/page.tsx
//
// ประกาศนโยบายการคุ้มครองข้อมูลส่วนบุคคลของเทศบาลนครหัวหิน
// จัดทำตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ShieldCheck,
  Search,
  Pencil,
  Trash2,
  Ban,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileText,
  UserCheck,
  Cpu,
  PhoneCall,
  ArrowRight,
  Info,
} from 'lucide-react'
import PrivacyTOC from './_components/PrivacyTOC'
import { PDPA_PRIVACY_NOTICE_EFFECTIVE_AT } from '@/lib/pdpa'
import { formatThaiDateLong } from '@/lib/thai-datetime'

export const metadata: Metadata = {
  title: 'ประกาศนโยบายการคุ้มครองข้อมูลส่วนบุคคล — เทศบาลนครหัวหิน',
  description:
    'ประกาศนโยบายการคุ้มครองข้อมูลส่วนบุคคลของระบบยื่นคำร้องขอภาพจากกล้องโทรทัศน์วงจรปิด เทศบาลนครหัวหิน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
}

const SECTIONS: ReadonlyArray<{ id: string; num: string; title: string; lead: string }> = [
  { id: 'data', num: '01', title: 'ข้อมูลส่วนบุคคลที่เก็บรวบรวม', lead: 'ประเภทของข้อมูลที่จัดเก็บ' },
  { id: 'purpose', num: '02', title: 'วัตถุประสงค์และฐานทางกฎหมาย', lead: 'การเก็บรวบรวม ใช้ และเปิดเผย' },
  { id: 'retention', num: '03', title: 'ระยะเวลาในการเก็บรักษาข้อมูล', lead: 'ระยะเวลาตามวัตถุประสงค์' },
  { id: 'sharing', num: '04', title: 'การเปิดเผยข้อมูลส่วนบุคคล', lead: 'หลักเกณฑ์การเปิดเผย' },
  { id: 'rights', num: '05', title: 'สิทธิของเจ้าของข้อมูลส่วนบุคคล', lead: 'สิทธิตามกฎหมายและการใช้สิทธิ' },
  { id: 'security', num: '06', title: 'มาตรการรักษาความมั่นคงปลอดภัย', lead: 'มาตรการทางเทคนิคและการบริหาร' },
  { id: 'cookies', num: '07', title: 'การใช้คุกกี้', lead: 'นโยบายคุกกี้' },
  { id: 'contact', num: '08', title: 'ช่องทางการติดต่อ', lead: 'ผู้ควบคุมข้อมูลส่วนบุคคล' },
]

const PRIVACY_NOTICE_EFFECTIVE_DATE_LABEL = formatThaiDateLong(PDPA_PRIVACY_NOTICE_EFFECTIVE_AT)

export default function PrivacyPolicyPage() {
  return (
    <main lang="th" className="cctv-bg-dot [text-wrap:pretty] min-h-screen">
      {/* Official header strip */}
      <div className="cctv-official">
        <div className="seal" aria-hidden />
        <div className="flex flex-col min-w-0">
          <span className="org-line1">เทศบาลนครหัวหิน · Hua Hin Municipality</span>
          <span className="org-line2">ระบบยื่นคำร้องขอภาพจากกล้อง CCTV</span>
        </div>
        <Link
          href="/request"
          className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
        >
          ยื่นคำร้อง
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {/* ============================================================
         HERO
         ============================================================ */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-14 sm:pb-12">
          <div className="cctv-eyebrow mb-2 inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            นโยบายความเป็นส่วนตัว · PRIVACY POLICY
          </div>
          <h1 className="mt-2 max-w-4xl tracking-tight">
            <span className="block text-[1.75rem] font-bold leading-[1.18] text-[var(--foreground)] sm:text-[2.25rem] lg:text-[2.5rem]">
              การคุ้มครองข้อมูลส่วนบุคคล
            </span>
          </h1>
          <div className="mt-3 max-w-3xl border-l-4 border-[var(--primary)] pl-3.5 sm:pl-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              อ้างอิงตามกฎหมาย
            </p>
            <p className="mt-1 text-[1.05rem] font-semibold leading-snug text-[var(--primary)] sm:text-[1.25rem] lg:text-[1.35rem]">
              <span className="block sm:inline">พระราชบัญญัติ</span>{' '}
              <span className="block sm:inline">คุ้มครองข้อมูลส่วนบุคคล</span>{' '}
              <span className="block sm:inline">พ.ศ. 2562</span>
            </p>
          </div>
          <div className="mt-5 max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
            <p className="text-[15px] font-semibold leading-relaxed text-[var(--foreground)] sm:text-base">
              เทศบาลนครหัวหินให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน
            </p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--muted-foreground)] sm:text-[15px] [text-wrap:pretty]">
              <span className="block">
                ประกาศฉบับนี้อธิบายการเก็บรวบรวม ใช้ เปิดเผย และเก็บรักษาข้อมูล
              </span>
              <span className="block">
                รวมถึงสิทธิของท่านในระบบยื่นคำร้องขอภาพจากกล้อง CCTV
              </span>
            </p>
            <ul className="mt-4 flex flex-wrap gap-2 text-[13.5px] leading-relaxed text-[var(--muted-foreground)]">
              {[
                'เก็บข้อมูลอะไร',
                'ใช้เพื่ออะไร',
                'มีสิทธิอย่างไร',
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/15 bg-[var(--primary)]/6 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[var(--muted-foreground)]">
            <span>ประกาศ ณ วันที่ {PRIVACY_NOTICE_EFFECTIVE_DATE_LABEL}</span>
            <span aria-hidden>·</span>
            <span>มีผลบังคับใช้ทันที</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden /> กฎหมายคุ้มครองข้อมูลส่วนบุคคล
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
         Body with sticky sidebar TOC
         ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar TOC (desktop) */}
        <aside className="hidden lg:block">
          <PrivacyTOC sections={SECTIONS} />
      
        </aside>

        {/* Mobile horizontal-scroll TOC */}
        <nav
          aria-label="สารบัญ"
          className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-hide"
        >
          <ol className="inline-flex gap-2 list-none m-0 p-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="m-0 shrink-0">
                <a
                  href={`#${s.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
                >
                  <span className="cctv-tabular text-[var(--primary)] font-bold">{s.num}</span>
                  <span className="whitespace-nowrap">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0">
          {/* Reserved promise (primary left-border quote block) */}
          <div className="cctv-card mb-7 sm:mb-9 flex gap-3 items-start p-5 sm:p-6 border-l-[3px] border-l-[var(--primary)]">
            <span className="text-[var(--primary)] mt-0.5 shrink-0">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="font-bold text-[15px] mb-1">ข้อสงวน</div>
              <div className="text-[14px] text-[var(--muted-foreground)] leading-relaxed">
                เทศบาลฯ จะไม่นำข้อมูลส่วนบุคคลของท่านไปใช้เพื่อการตลาด การโฆษณา
                หรือเพื่อแสวงหาประโยชน์ทางการค้าในทุกกรณี
              </div>
            </div>
          </div>

          {/* ============================================================
             01 — ข้อมูลส่วนบุคคลที่เก็บรวบรวม
             ============================================================ */}
          <ContentSection
            id="data"
            num="01"
            title="ข้อมูลส่วนบุคคลที่เก็บรวบรวม"
            summary="เทศบาลฯ จะเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเท่าที่จำเป็นต่อการให้บริการตามวัตถุประสงค์ของระบบ โดยจำแนกเป็น 3 ประเภท ดังนี้"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DataGroup
                icon={UserCheck}
                label="ข้อมูลที่ใช้ระบุตัวบุคคล"
                items={[
                  'คำนำหน้า ชื่อ-นามสกุล อายุ',
                  'เลขประจำตัวประชาชน หรือเลขหนังสือเดินทาง',
                  'หมายเลขโทรศัพท์',
                  'ที่อยู่ปัจจุบัน',
                  'ความเกี่ยวข้องของท่านกับเหตุการณ์',
                ]}
              />
              <DataGroup
                icon={FileText}
                label="ข้อมูลคำร้องและเอกสารประกอบ"
                items={[
                  'วัน เวลา และสถานที่เกิดเหตุ พร้อมรายละเอียด',
                  'สำเนาบันทึกประจำวัน',
                  'สำเนาบัตรประจำตัวประชาชน',
                  'ภาพถ่ายใบหน้าเพื่อการยืนยันตัวตน',
                ]}
              />
              <DataGroup
                icon={Cpu}
                label="ข้อมูลการใช้งานระบบ"
                items={[
                  'หมายเลขไอพีของอุปกรณ์',
                  'ชนิดและรุ่นของอุปกรณ์หรือเว็บเบราว์เซอร์',
                  'LINE user ID ชื่อโปรไฟล์ และสถานะการเป็นเพื่อนกับ LINE OA ',
                  'ข้อมูล session, token,และเวลาการเชื่อมคำร้องกับ LINE',
                  'วันและเวลาที่ท่านให้ความยินยอม',
                ]}
              />
            </div>

            <Callout tone="warning" icon={AlertTriangle} title="ข้อมูลส่วนบุคคลที่มีความอ่อนไหว">
              <p>
                ในการให้บริการ เทศบาลฯ มีความจำเป็นต้องเก็บรวบรวมภาพถ่ายใบหน้าของท่านเพื่อใช้
                ในการยืนยันตัวตน ซึ่งถือเป็นข้อมูลชีวภาพและเป็นข้อมูลส่วนบุคคลที่มีความอ่อนไหว
                ตามมาตรา 26 แห่งพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                จึงต้องดำเนินการโดยอาศัยความยินยอมโดยชัดแจ้งจากท่าน
                และจะไม่นำไปใช้นอกเหนือจากวัตถุประสงค์ที่ได้แจ้งไว้
              </p>
              <p className="mt-2">
                ทั้งนี้ เทศบาลฯ จะไม่เก็บรวบรวมข้อมูลส่วนบุคคลที่มีความอ่อนไหวประเภทอื่น
                อาทิ ข้อมูลศาสนา เชื้อชาติ ความคิดเห็นทางการเมือง ประวัติอาชญากรรม หรือข้อมูลสุขภาพ
              </p>
            </Callout>

            <div className="rounded-xl bg-[var(--cctv-bg-muted,var(--muted))] border border-[var(--border)] px-5 py-4 text-sm leading-relaxed text-[var(--foreground)] [text-wrap:pretty] [overflow-wrap:anywhere]">
              <strong>กรณีผู้เยาว์ —</strong>{' '}
              ในกรณีที่ท่านเป็นผู้เยาว์อายุไม่เกิน 20 ปีบริบูรณ์
              การให้ความยินยอมจะต้องได้รับความยินยอมจากผู้ใช้อำนาจปกครองตามกฎหมายร่วมด้วย
            </div>
          </ContentSection>

          {/* ============================================================
             02 — วัตถุประสงค์และฐานทางกฎหมาย
             ============================================================ */}
          <ContentSection
            id="purpose"
            num="02"
            title="วัตถุประสงค์และฐานทางกฎหมาย"
            summary="เทศบาลฯ จะเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลของท่าน เพื่อวัตถุประสงค์ดังต่อไปนี้"
          >
            <ol className="space-y-2 list-none m-0 p-0">
              {[
                'เพื่อตรวจสอบและยืนยันตัวตนของผู้ยื่นคำร้อง',
                'เพื่อสืบค้นภาพหรือวิดีโอจากกล้องโทรทัศน์วงจรปิด ตามรายละเอียดที่ท่านระบุในคำร้อง',
                'เพื่อติดต่อกลับ แจ้งสถานะคำร้อง หรือสอบถามข้อมูลเพิ่มเติม',
                'เพื่อส่งมอบไฟล์ภาพหรือวิดีโอเมื่อคำร้องของท่านได้รับการอนุมัติ',
                'เพื่อยืนยันตัวตนผ่าน LINE ผูกคำร้องกับ LINE user ID และตรวจสอบสถานะการเป็นเพื่อนกับ LINE OA สำหรับการแจ้งผล',
                'เพื่อจัดทำสถิติและพัฒนาคุณภาพการให้บริการ ในรูปแบบที่ไม่สามารถระบุตัวบุคคลได้',
                'เพื่อปฏิบัติตามกฎหมาย คำสั่งศาล หรือคำสั่งของหน่วยงานรัฐที่มีอำนาจตามกฎหมาย',
              ].map((t, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3.5"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[12px] font-bold text-[var(--primary)] cctv-tabular">
                    {i + 1}
                  </span>
                  <span className="text-[14.5px] leading-relaxed text-[var(--foreground)]">
                    {t}
                  </span>
                </li>
              ))}
            </ol>

            <Callout tone="success" icon={CheckCircle2} title="ข้อสงวน">
              <p>
                เทศบาลฯ จะไม่นำข้อมูลส่วนบุคคลของท่านไปใช้เพื่อการตลาด การโฆษณา
                หรือเพื่อแสวงหาประโยชน์ทางการค้าในทุกกรณี
              </p>
            </Callout>

            <div className="cctv-card p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
                  <Scale className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  ฐานทางกฎหมายในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)] mb-4">
                ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                เทศบาลฯ ดำเนินการภายใต้ฐานทางกฎหมาย ดังนี้
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <LegalBasis
                  label="ภารกิจเพื่อประโยชน์สาธารณะ"
                  article="มาตรา 24 (4)"
                  desc="สำหรับการรับ ตรวจสอบ พิจารณา และดำเนินคำร้องภายใต้อำนาจหน้าที่ของเทศบาลนครด้านความสงบเรียบร้อยและความปลอดภัยของประชาชน"
                />
                <LegalBasis
                  label="ความยินยอมโดยชัดแจ้ง"
                  article="มาตรา 19 และมาตรา 26"
                  desc="สำหรับภาพถ่ายใบหน้าเพื่อยืนยันตัวตน และข้อมูลชีวภาพหรือข้อมูลที่มีความอ่อนไหวเฉพาะเท่าที่จำเป็นต่อคำร้อง"
                />
                <LegalBasis
                  label="การปฏิบัติตามกฎหมาย"
                  article="มาตรา 24 (6)"
                  desc="สำหรับการจัดเก็บเอกสารราชการ การจัดทำหลักฐานตรวจสอบ และการเปิดเผยต่อศาล พนักงานสอบสวน หรือหน่วยงานรัฐที่มีอำนาจตามกฎหมาย"
                />
              </div>
            </div>
          </ContentSection>

          {/* ============================================================
             03 — ระยะเวลาในการเก็บรักษา
             ============================================================ */}
          <ContentSection
            id="retention"
            num="03"
            title="ระยะเวลาในการเก็บรักษาข้อมูลส่วนบุคคล"
            summary="เทศบาลฯ จะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้เท่าที่จำเป็นต่อวัตถุประสงค์ที่ได้แจ้ง เมื่อพ้นกำหนดระยะเวลา ข้อมูลจะถูกลบหรือทำลายด้วยวิธีการที่ปลอดภัย"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <RetentionBox num="7" unit="ปี" desc="ข้อมูลคำร้อง เอกสารประกอบ และหลักฐานการดำเนินงานราชการ นับแต่วันที่คำร้องสิ้นสุด เว้นแต่กฎหมายกำหนดให้เก็บนานกว่า" />
              <RetentionBox num="30" unit="วัน" desc="ภาพย้อนหลังในระบบกล้องโทรทัศน์วงจรปิดตามขีดความสามารถของระบบ ก่อนถูกเขียนทับหรือลบตามรอบจัดเก็บ" />
              <RetentionBox num="7" unit="ปี" desc="หลักฐานการให้ความยินยอมและบันทึกการใช้สิทธิ เพื่อพิสูจน์การปฏิบัติตามกฎหมาย" />
              <RetentionBox num="24" unit="ชม." desc="token หรือลิงก์ชั่วคราวสำหรับแจ้งผลผ่าน LINE เมื่อครบกำหนดจะหมดอายุ" />
            </div>
          </ContentSection>

          {/* ============================================================
             04 — การเปิดเผยข้อมูลส่วนบุคคล
             ============================================================ */}
          <ContentSection
            id="sharing"
            num="04"
            title="การเปิดเผยข้อมูลส่วนบุคคล"
            summary="เทศบาลฯ จะเปิดเผยข้อมูลส่วนบุคคลของท่านเฉพาะเท่าที่จำเป็น และต้องอยู่ภายใต้ฐานทางกฎหมายเท่านั้น"
          >
            <div
              className="rounded-2xl border-2 p-5"
              style={{
                borderColor: 'color-mix(in oklch, var(--success) 35%, transparent)',
                backgroundColor: 'color-mix(in oklch, var(--success) 6%, transparent)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--success)_18%,transparent)] text-[var(--success)]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-[15px] font-semibold leading-relaxed text-[var(--foreground)] [text-wrap:pretty]">
                  เทศบาลฯ
                  <span className="text-[var(--success)]">
                    {' '}จะไม่เปิดเผย จำหน่าย จ่าย แจก แลกเปลี่ยน หรือถ่ายโอน{' '}
                  </span>
                  ข้อมูลส่วนบุคคลของท่านให้แก่บุคคลภายนอกเพื่อประโยชน์ทางการค้าหรือการตลาดในทุกกรณี
                </p>
              </div>
            </div>

            <p className="max-w-3xl text-[14.5px] leading-relaxed text-[var(--foreground)]">
              อย่างไรก็ตาม เทศบาลฯ อาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้แก่บุคคลหรือหน่วยงาน
              เฉพาะเท่าที่จำเป็นและภายใต้ฐานทางกฎหมาย ดังนี้
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ShareItem
                title="พนักงานสอบสวนหรือเจ้าหน้าที่ตำรวจ"
                desc="ที่ขอข้อมูลเพื่อใช้ในการสืบสวนหรือดำเนินคดีตามกฎหมาย"
              />
              <ShareItem title="ศาลหรือหน่วยงานรัฐ" desc="ที่มีคำสั่งหรือหมายตามกฎหมาย" />
              <ShareItem
                title="ผู้ให้บริการที่ดำเนินการในนามของเทศบาลฯ"
                desc="ภายใต้สัญญาที่กำหนดมาตรการคุ้มครองข้อมูลส่วนบุคคลตามที่กฎหมายกำหนด"
              />
              <ShareItem
                title="ผู้ให้บริการระบบ LINE และระบบโครงสร้างพื้นฐาน"
                desc="เฉพาะข้อมูลที่จำเป็นต่อการเข้าสู่ระบบ การเชื่อมคำร้อง การแจ้งผล และการให้บริการเว็บไซต์หรือพื้นที่จัดเก็บไฟล์"
              />
            </div>
          </ContentSection>

          {/* ============================================================
             05 — สิทธิของเจ้าของข้อมูล
             ============================================================ */}
          <ContentSection
            id="rights"
            num="05"
            title="สิทธิของเจ้าของข้อมูลส่วนบุคคล"
            summary="ท่านในฐานะเจ้าของข้อมูลส่วนบุคคลมีสิทธิตามที่บัญญัติไว้ในพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ดังต่อไปนี้"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RightCard
                icon={Search}
                title="สิทธิในการขอเข้าถึงข้อมูลส่วนบุคคล"
                article="มาตรา 30"
                desc="ขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคลของท่านที่อยู่ในความรับผิดชอบของเทศบาลฯ"
              />
              <RightCard
                icon={FileText}
                title="สิทธิในการขอรับหรือโอนย้ายข้อมูล"
                article="มาตรา 31"
                desc="ขอรับข้อมูลส่วนบุคคลในรูปแบบที่อ่านหรือใช้งานโดยทั่วไปได้ ในกรณีที่กฎหมายกำหนด"
              />
              <RightCard
                icon={Ban}
                title="สิทธิในการคัดค้านการประมวลผล"
                article="มาตรา 32"
                desc="คัดค้านการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลในกรณีที่กฎหมายเปิดให้คัดค้านได้"
              />
              <RightCard
                icon={Pencil}
                title="สิทธิในการขอแก้ไขข้อมูลส่วนบุคคล"
                article="มาตรา 35-36"
                desc="ขอให้ดำเนินการแก้ไขข้อมูลให้ถูกต้อง เป็นปัจจุบัน สมบูรณ์ และไม่ก่อให้เกิดความเข้าใจผิด"
              />
              <RightCard
                icon={Trash2}
                title="สิทธิในการขอให้ลบหรือทำลายข้อมูล"
                article="มาตรา 33"
                desc="ขอให้ลบ ทำลาย หรือทำให้ข้อมูลไม่สามารถระบุตัวบุคคลได้ ในกรณีที่กฎหมายกำหนด"
              />
              <RightCard
                icon={AlertTriangle}
                title="สิทธิในการระงับการใช้ข้อมูล"
                article="มาตรา 34"
                desc="ขอให้ระงับการใช้ข้อมูลส่วนบุคคลไว้ชั่วคราวในกรณีที่กฎหมายกำหนด"
              />
              <RightCard
                icon={Info}
                title="สิทธิในการเพิกถอนความยินยอม"
                article="มาตรา 19 วรรคห้า"
                desc="เพิกถอนความยินยอมที่ได้ให้ไว้ในเวลาใดก็ได้ โดยแจ้งความประสงค์มายังเทศบาลฯ"
              />
              <RightCard
                icon={Scale}
                title="สิทธิในการร้องเรียน"
                article="มาตรา 73"
                desc="ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เมื่อเห็นว่าการดำเนินการไม่เป็นไปตามกฎหมาย"
              />
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
              การเพิกถอนความยินยอมจะไม่กระทบต่อการเก็บรวบรวม ใช้
              หรือเปิดเผยข้อมูลส่วนบุคคลที่ท่านได้ให้ความยินยอมไว้แล้วโดยชอบ
              ก่อนการเพิกถอนความยินยอมนั้น
            </p>

            <div className="cctv-card overflow-hidden">
              <div className="cctv-card-head">
                <span className="cctv-num">i</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">วิธีการใช้สิทธิ</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    ท่านสามารถใช้สิทธิข้างต้นได้ โดยปฏิบัติตาม 3 ขั้นตอน
                  </p>
                </div>
              </div>
              <ol className="divide-y divide-[var(--border)] list-none m-0 p-0">
                <Step
                  n="1"
                  title="ยื่นคำขอใช้สิทธิ"
                  desc="ติดต่อเทศบาลฯ ตามช่องทางที่ระบุในข้อ 8 และระบุประเภทสิทธิที่ท่านประสงค์จะใช้"
                />
                <Step
                  n="2"
                  title="ยืนยันตัวตน"
                  desc="จัดเตรียมเอกสารยืนยันตัวตน เช่น สำเนาบัตรประจำตัวประชาชน เพื่อให้เจ้าหน้าที่ตรวจสอบว่าท่านเป็นเจ้าของข้อมูลส่วนบุคคลที่แท้จริง"
                />
                <Step
                  n="3"
                  title="รับผลการดำเนินการ"
                  desc="เทศบาลฯ จะดำเนินการและแจ้งผลให้ท่านทราบภายในระยะเวลาที่กฎหมายกำหนด โดยทั่วไปไม่เกิน 30 วันนับแต่วันที่ได้รับคำขอและเอกสารยืนยันตัวตนครบถ้วน"
                />
              </ol>
            </div>
          </ContentSection>

          {/* ============================================================
             06 — มาตรการรักษาความมั่นคงปลอดภัย
             ============================================================ */}
          <ContentSection
            id="security"
            num="06"
            title="มาตรการรักษาความมั่นคงปลอดภัยของข้อมูลส่วนบุคคล"
            summary="เทศบาลฯ จัดให้มีมาตรการรักษาความมั่นคงปลอดภัยที่เหมาะสมตามมาตรฐาน เพื่อป้องกันการสูญหาย เข้าถึง ใช้ เปลี่ยนแปลง แก้ไข หรือเปิดเผยข้อมูลโดยมิชอบ"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SecurityItem desc="การเข้ารหัสข้อมูลในการรับส่งผ่านเครือข่ายตามมาตรฐานสากล" />
              <SecurityItem desc="การจำกัดสิทธิ์การเข้าถึงข้อมูลให้แก่เจ้าหน้าที่ที่ได้รับมอบหมายเท่านั้น" />
              <SecurityItem desc="การจัดเก็บบันทึกการเข้าถึงข้อมูลทุกครั้งเพื่อการตรวจสอบย้อนหลัง" />
              <SecurityItem desc="การสำรองข้อมูลและตรวจสอบช่องโหว่ของระบบอย่างสม่ำเสมอ" />
              <SecurityItem desc="การจัดเก็บข้อมูลที่มีความอ่อนไหวด้วยวิธีการที่ลดความเสี่ยงต่อการรั่วไหล" />
              <SecurityItem desc="การจัดให้มีกระบวนการรับมือและแจ้งเหตุละเมิดข้อมูลส่วนบุคคล" />
            </div>
          </ContentSection>

          {/* ============================================================
             07 — คุกกี้
             ============================================================ */}
          <ContentSection
            id="cookies"
            num="07"
            title="การใช้คุกกี้"
            summary="เว็บไซต์ของเทศบาลฯ มีการใช้คุกกี้เท่าที่จำเป็นต่อการทำงานของระบบ โดยมีวัตถุประสงค์ดังนี้"
          >
            <ul className="space-y-2 list-none m-0 p-0">
              {[ 
                'เพื่อรักษาสถานะการเข้าสู่ระบบของท่าน',
                'เพื่อจดจำการตั้งค่าภาษาที่ท่านเลือก',
                'เพื่อแจ้งผลคำร้องขอภาพจากกล้อง CCTV ช่องทาง LINE OA ',
              ].map((t, i) => (
                
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-[14.5px] leading-relaxed text-[var(--foreground)]"
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Callout tone="success" icon={CheckCircle2} title="ข้อสงวน">
              <p>
                เทศบาลฯ ไม่ใช้คุกกี้เพื่อการโฆษณา ทั้งนี้ ระบบอาจใช้คุกกี้หรือข้อมูลที่จำเป็นจาก LINE 
                เพื่อการเข้าสู่ระบบและการแจ้งผลตามคำร้องเท่านั้น
              </p>
            </Callout>
            <p className="max-w-3xl text-[14.5px] leading-relaxed text-[var(--muted-foreground)]">
              ท่านสามารถปิดการใช้งานคุกกี้ได้ที่การตั้งค่าของเว็บเบราว์เซอร์
              อย่างไรก็ตาม การปิดคุกกี้อาจส่งผลให้บางส่วนของระบบทำงานไม่สมบูรณ์
            </p>
          </ContentSection>
        </main>
      </div>

      {/* ============================================================
         Contact section — full-width (breaks out of sidebar grid)
         ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
        <section id="contact" className="scroll-mt-24 mb-8">
            <div className="cctv-section-head">
              <span className="num">08</span>
              <h2 className="m-0 text-[1.5rem] sm:text-[1.75rem] font-bold leading-tight tracking-tight text-[var(--foreground)]">
                ช่องทางการติดต่อ
              </h2>
              <span className="rule" />
            </div>
            <p className="text-[14.5px] sm:text-[15px] leading-relaxed text-[var(--muted-foreground)] max-w-3xl mb-5">
              ในกรณีที่ท่านมีข้อสงสัยเกี่ยวกับประกาศฉบับนี้
              หรือประสงค์จะใช้สิทธิตามที่กำหนด
              สามารถติดต่อผู้ควบคุมข้อมูลส่วนบุคคลได้ตามช่องทางดังต่อไปนี้
            </p>

            <div
              className="rounded-2xl p-6 sm:p-8 border border-[var(--border)] text-[var(--primary-foreground)]"
              style={{
                background:
                  'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 70%, black) 100%)',
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <MapPin className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="min-w-0 flex-1 text-base font-bold leading-snug [text-wrap:balance]">ติดต่อเทศบาลฯ</h3>
                  </div>
                  <address className="not-italic text-[14.5px] leading-relaxed opacity-95 [text-wrap:pretty]">
                    <span className="block font-semibold">เทศบาลนครหัวหิน</span>
                    <span className="block">ศูนย์ควบคุมกล้องโทรทัศน์วงจรปิด (CCTV)</span>
                    <span className="mt-1.5 block">114 ถนนเพชรเกษม</span>
                    <span className="block">ตำบลหัวหิน อำเภอหัวหิน</span>
                    <span className="block">จังหวัดประจวบคีรีขันธ์ 77110</span>
                  </address>
                </div>

                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <PhoneCall className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="min-w-0 flex-1 text-base font-bold leading-snug [text-wrap:balance]">โทรศัพท์</h3>
                  </div>
                  <a
                    href="tel:032511047"
                    className="inline-block text-xl sm:text-2xl font-bold tracking-wide cctv-tabular underline decoration-white/40 underline-offset-4 hover:decoration-white whitespace-nowrap"
                  >
                    0-3251-1047 ต่อ 310
                  </a>
                  <p className="mt-2 text-sm opacity-80 [text-wrap:pretty]">
                    <span className="block">ติดต่อในวันและเวลาราชการ</span>
                    <span className="block">จันทร์ถึงศุกร์</span>
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Info className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="min-w-0 flex-1 text-base font-bold leading-snug [text-wrap:balance]">
                      เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล
                    </h3>
                  </div>
                  <address className="not-italic text-[14.5px] leading-relaxed opacity-95 [text-wrap:pretty]">
                    <span className="block font-semibold">คณะทำงานคุ้มครองข้อมูลส่วนบุคคล</span>
                    <span className="block">สำนักงานเทศบาลนครหัวหิน</span>
                    <span className="mt-1.5 block">114 ถนนเพชรเกษม</span>
                    <span className="block">ตำบลหัวหิน อำเภอหัวหิน</span>
                    <span className="block">จังหวัดประจวบคีรีขันธ์ 77110</span>
                  </address>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/contract"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--primary)] px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
                >
                  ดูช่องทางการติดต่อราชการเพิ่มเติม
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          {/* Footer note */}
          <div className="mt-10 pt-6 border-t border-[var(--border)]">
            <p className="text-center text-xs sm:text-[13px] leading-relaxed text-[var(--muted-foreground)] max-w-2xl mx-auto">
              ประกาศฉบับนี้อาจมีการแก้ไขปรับปรุงให้สอดคล้องกับกฎหมายและการให้บริการของเทศบาลฯ
              ที่เปลี่ยนแปลงไป กรณีที่มีการเปลี่ยนแปลงในสาระสำคัญ เทศบาลฯ จะแจ้งให้ท่านทราบ
              และขอความยินยอมใหม่ก่อนการใช้บริการในครั้งถัดไป
            </p>
          </div>
      </div>
    </main>
  )
}

/* ================================================================
   Pieces
   ================================================================ */

function ContentSection({
  id,
  num,
  title,
  summary,
  children,
}: {
  id: string
  num: string
  title: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-10 sm:mb-12">
      <div className="cctv-section-head">
        <span className="num">{num}</span>
        <h2 className="m-0 text-[1.5rem] sm:text-[1.75rem] font-bold leading-tight tracking-tight text-[var(--foreground)] [text-wrap:balance]">
          {title}
        </h2>
        <span className="rule" />
      </div>
      <p className="max-w-3xl text-[14.5px] sm:text-[15px] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty] mb-5">
        {summary}
      </p>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function DataGroup({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  items: string[]
}) {
  return (
    <div className="cctv-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-[var(--border)]">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance] [overflow-wrap:anywhere]">
          {label}
        </h3>
      </div>
      <ul className="space-y-2 text-sm leading-relaxed text-[var(--foreground)] m-0 p-0 list-none">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-2.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
            <span className="min-w-0 flex-1 [text-wrap:pretty] [overflow-wrap:anywhere]">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'warning' | 'success'
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  children: React.ReactNode
}) {
  const colorVar = tone === 'warning' ? 'var(--warning)' : 'var(--success)'
  return (
    <div
      className="rounded-2xl border-2 p-5"
      style={{
        borderColor: `color-mix(in oklch, ${colorVar} 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${colorVar} 6%, transparent)`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklch, ${colorVar} 18%, transparent)`,
            color: colorVar,
          }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="flex min-h-9 items-center text-[15px] font-bold leading-snug text-[var(--foreground)] [text-wrap:balance] [overflow-wrap:anywhere]">
            {title}
          </h3>
          <div className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--foreground)] [text-wrap:pretty] [overflow-wrap:anywhere]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function LegalBasis({ label, article, desc }: { label: string; article: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--cctv-bg-muted,var(--muted))] p-4">
      <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--primary)]">
        {article}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
        {label}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{desc}</p>
    </div>
  )
}

function RetentionBox({ num, unit, desc }: { num: string; unit: string; desc: string }) {
  return (
    <div className="cctv-card p-5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl sm:text-5xl font-bold leading-none tracking-tight text-[var(--primary)] cctv-tabular">
          {num}
        </span>
        <span className="text-base font-semibold text-[var(--muted-foreground)]">{unit}</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">
        {desc}
      </p>
    </div>
  )
}

function ShareItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 h-full">
      <p className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{desc}</p>
    </div>
  )
}

function RightCard({
  icon: Icon,
  title,
  article,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  article: string
  desc: string
}) {
  return (
    <div className="cctv-card p-5 hover:border-[color-mix(in_oklch,var(--primary)_40%,var(--border))] transition">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-[var(--success)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--primary)]">
            {article}
          </p>
          <h3 className="mt-1 text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
            {title}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">
            {desc}
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-4 px-5 sm:px-6 py-4">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-bold cctv-tabular">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
          {title}
        </h4>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">
          {desc}
        </p>
      </div>
    </li>
  )
}

function SecurityItem({ desc }: { desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3.5">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-[14px] leading-relaxed text-[var(--foreground)] [text-wrap:pretty]">
        {desc}
      </span>
    </div>
  )
}
