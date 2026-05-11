// app/privacy-policy/page.tsx
//
// ประกาศนโยบายการคุ้มครองข้อมูลส่วนบุคคลของเทศบาลนครหัวหิน
// จัดทำตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ShieldCheck,
  Database,
  Target,
  Clock,
  Search,
  Pencil,
  Trash2,
  Ban,
  MapPin,
  Lock,
  Cookie,
  Users,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileText,
  UserCheck,
  Cpu,
  PhoneCall,
  ArrowRight,
} from 'lucide-react'

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

export default function PrivacyPolicyPage() {
  return (
    <main lang="th" className="[text-wrap:pretty]">
      {/* ============================================================
         HERO
         ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(60% 80% at 15% 0%, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 60%), radial-gradient(55% 75% at 100% 30%, color-mix(in oklch, var(--primary) 7%, transparent) 0%, transparent 60%)',
        }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-24 pb-16 sm:pt-28 sm:pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-white/80 backdrop-blur px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-[var(--primary)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            เทศบาลนครหัวหิน
          </div>

          <h1 className="mt-6 text-2xl sm:text-3xl lg:text-[2.5rem] font-bold leading-[1.3] text-[var(--foreground)] [text-wrap:balance]">
            ประกาศนโยบายการคุ้มครองข้อมูลส่วนบุคคล
          </h1>

          <p className="mt-3 text-base sm:text-lg font-medium leading-relaxed text-[var(--foreground)]/80 [text-wrap:balance]">
            ระบบยื่นคำร้องขอภาพจากกล้องโทรทัศน์วงจรปิด
          </p>

          <div className="mt-7 max-w-3xl space-y-3 text-[15px] sm:text-base leading-loose text-[var(--foreground)]">
            <p>
              เทศบาลนครหัวหิน ในฐานะผู้ควบคุมข้อมูลส่วนบุคคล
              ตระหนักถึงความสำคัญของการคุ้มครองข้อมูลส่วนบุคคล
              และดำเนินการตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
              จึงจัดทำประกาศฉบับนี้ขึ้นเพื่อแจ้งให้ท่านทราบรายละเอียดเกี่ยวกับการเก็บรวบรวม
              ใช้ และเปิดเผยข้อมูลส่วนบุคคล
              รวมถึงสิทธิของท่านในฐานะเจ้าของข้อมูลส่วนบุคคล
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-[12px] sm:text-[13px]">
            <span className="rounded-full bg-white border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--foreground)]">
              พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            </span>
            <span className="rounded-full bg-white border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--foreground)]">
              ประกาศ ณ วันที่ 9 พฤษภาคม 2569
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
         สารบัญ
         ============================================================ */}
      <section className="border-y border-[var(--border)] bg-[var(--muted)]/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] [text-wrap:balance]">
              สารบัญ
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              คลิกหัวข้อเพื่อข้ามไปยังส่วนที่ต้องการ
            </p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 list-none m-0 p-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="m-0">
                <a
                  href={`#${s.id}`}
                  className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 transition hover:border-[var(--primary)] hover:shadow-sm h-full"
                >
                  <span className="text-xs font-bold tabular-nums text-[var(--primary)] tracking-widest pt-0.5">
                    {s.num}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-[var(--foreground)] group-hover:text-[var(--primary)] transition">
                      {s.title}
                    </span>
                    <span className="block mt-1 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                      {s.lead}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================================================
         01 — ข้อมูลส่วนบุคคลที่เก็บรวบรวม
         ============================================================ */}
      <ContentSection
        id="data"
        num="01"
        title="ข้อมูลส่วนบุคคลที่เก็บรวบรวม"
        summary="เทศบาลฯ จะเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเท่าที่จำเป็นต่อการให้บริการตามวัตถุประสงค์ของระบบ โดยจำแนกเป็น 3 ประเภท ดังนี้"
        icon={Database}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DataGroup
            icon={UserCheck}
            label="ข้อมูลที่ใช้ระบุตัวบุคคล"
            items={[
              'คำนำหน้านาม ชื่อ-นามสกุล อายุ',
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
              'สำเนาบันทึกประจำวันของพนักงานสอบสวน (หากมี)',
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
              'รหัสผู้ใช้ไลน์ เฉพาะกรณีเข้าใช้งานผ่านไลน์',
              'วันและเวลาที่ท่านให้ความยินยอม',
            ]}
          />
        </div>

        <Callout
          tone="warning"
          icon={AlertTriangle}
          title="ข้อมูลส่วนบุคคลที่มีความอ่อนไหว"
        >
          <p>
            ในการให้บริการ เทศบาลฯ
            มีความจำเป็นต้องเก็บรวบรวมภาพถ่ายใบหน้าของท่านเพื่อใช้ในการยืนยันตัวตน
            ซึ่งถือเป็นข้อมูลชีวภาพและเป็นข้อมูลส่วนบุคคลที่มีความอ่อนไหวตามมาตรา
            26 แห่งพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            จึงต้องดำเนินการโดยอาศัยความยินยอมโดยชัดแจ้งจากท่าน
            และจะไม่นำไปใช้นอกเหนือจากวัตถุประสงค์ที่ได้แจ้งไว้
          </p>
          <p className="mt-2">
            ทั้งนี้
            เทศบาลฯ จะไม่เก็บรวบรวมข้อมูลส่วนบุคคลที่มีความอ่อนไหวประเภทอื่น
            อาทิ ข้อมูลศาสนา เชื้อชาติ ความคิดเห็นทางการเมือง
            ประวัติอาชญากรรม หรือข้อมูลสุขภาพ
          </p>
        </Callout>

        <div className="rounded-2xl bg-[var(--muted)]/50 border border-[var(--border)] px-5 py-4 text-sm leading-loose text-[var(--foreground)]">
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
        icon={Target}
        alt
      >
        <ol className="space-y-2.5 list-none m-0 p-0">
          {[
            'เพื่อตรวจสอบและยืนยันตัวตนของผู้ยื่นคำร้อง',
            'เพื่อสืบค้นภาพหรือวิดีโอจากกล้องโทรทัศน์วงจรปิด ตามรายละเอียดที่ท่านระบุในคำร้อง',
            'เพื่อติดต่อกลับ แจ้งสถานะคำร้อง หรือสอบถามข้อมูลเพิ่มเติม',
            'เพื่อส่งมอบไฟล์ภาพหรือวิดีโอเมื่อคำร้องของท่านได้รับการอนุมัติ',
            'เพื่อจัดทำสถิติและพัฒนาคุณภาพการให้บริการ ในรูปแบบที่ไม่สามารถระบุตัวบุคคลได้',
            'เพื่อปฏิบัติตามกฎหมาย คำสั่งศาล หรือคำสั่งของหน่วยงานรัฐที่มีอำนาจตามกฎหมาย',
          ].map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-white border border-[var(--border)] px-4 py-3.5"
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[12px] font-bold text-[var(--primary)] tabular-nums">
                {i + 1}
              </span>
              <span className="text-[15px] leading-loose text-[var(--foreground)]">
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

        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Scale className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="text-base font-bold text-[var(--foreground)]">
              ฐานทางกฎหมายในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล
            </h3>
          </div>
          <p className="text-sm leading-loose text-[var(--muted-foreground)] mb-4">
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            เทศบาลฯ ดำเนินการภายใต้ฐานทางกฎหมาย ดังนี้
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LegalBasis
              label="ความยินยอมของเจ้าของข้อมูล"
              article="มาตรา 19"
              desc="สำหรับข้อมูลที่ท่านกรอกเอง รวมถึงภาพถ่ายใบหน้าซึ่งเป็นข้อมูลที่มีความอ่อนไหว"
            />
            <LegalBasis
              label="การปฏิบัติหน้าที่เพื่อประโยชน์สาธารณะ"
              article="มาตรา 24 (4)"
              desc="ในการดำเนินภารกิจรักษาความสงบเรียบร้อยและความปลอดภัยของประชาชน"
            />
            <LegalBasis
              label="การปฏิบัติตามกฎหมาย"
              article="มาตรา 24 (6)"
              desc="ในการเก็บรักษาเอกสารราชการและส่งข้อมูลให้แก่หน่วยงานที่มีอำนาจตามกฎหมาย"
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
        icon={Clock}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <RetentionBox
            num="5"
            unit="ปี"
            desc="ข้อมูลคำร้องและเอกสารประกอบ นับแต่วันที่คำร้องสิ้นสุด"
          />
          <RetentionBox
            num="30"
            unit="วัน"
            desc="ภาพจากกล้องโทรทัศน์วงจรปิด ตามขีดความสามารถของระบบ"
          />
          <RetentionBox
            num="2"
            unit="ปี"
            desc="หลักฐานการให้ความยินยอม เพื่อรองรับการตรวจสอบ"
          />
          <RetentionBox
            num="1"
            unit="ปี"
            desc="บันทึกการเข้าใช้งานระบบ เพื่อความมั่นคงปลอดภัย"
          />
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
        icon={Users}
        alt
      >
        <div className="rounded-2xl border-2 border-[var(--success)]/35 bg-[var(--success)]/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[15px] sm:text-base font-semibold leading-loose text-[var(--foreground)] [text-wrap:pretty]">
              เทศบาลฯ
              <span className="text-[var(--success)]">
                {' '}จะไม่เปิดเผย จำหน่าย จ่าย แจก แลกเปลี่ยน หรือถ่ายโอน{' '}
              </span>
              ข้อมูลส่วนบุคคลของท่านให้แก่บุคคลภายนอก
              เพื่อประโยชน์ทางการค้าหรือการตลาดในทุกกรณี
            </p>
          </div>
        </div>

        <p className="max-w-3xl text-[15px] leading-loose text-[var(--foreground)]">
          อย่างไรก็ตาม เทศบาลฯ
          อาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้แก่บุคคลหรือหน่วยงาน
          เฉพาะเท่าที่จำเป็นและภายใต้ฐานทางกฎหมาย ดังนี้
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ShareItem
            title="พนักงานสอบสวนหรือเจ้าหน้าที่ตำรวจ"
            desc="ที่ขอข้อมูลเพื่อใช้ในการสืบสวนหรือดำเนินคดีตามกฎหมาย"
          />
          <ShareItem
            title="ศาลหรือหน่วยงานรัฐ"
            desc="ที่มีคำสั่งหรือหมายตามกฎหมาย"
          />
          <ShareItem
            title="ผู้ให้บริการที่ดำเนินการในนามของเทศบาลฯ"
            desc="ภายใต้สัญญาที่กำหนดมาตรการคุ้มครองข้อมูลส่วนบุคคลตามที่กฎหมายกำหนด"
          />
        </div>
      </ContentSection>

      {/* ============================================================
         05 — สิทธิของเจ้าของข้อมูลส่วนบุคคล
         ============================================================ */}
      <ContentSection
        id="rights"
        num="05"
        title="สิทธิของเจ้าของข้อมูลส่วนบุคคล"
        summary="ท่านในฐานะเจ้าของข้อมูลส่วนบุคคลมีสิทธิตามที่บัญญัติไว้ในพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ดังต่อไปนี้"
        icon={ShieldCheck}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RightCard
            icon={Search}
            title="สิทธิในการขอเข้าถึงข้อมูลส่วนบุคคล"
            article="มาตรา 30"
            desc="ขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคลของท่านที่อยู่ในความรับผิดชอบของเทศบาลฯ"
          />
          <RightCard
            icon={Pencil}
            title="สิทธิในการขอแก้ไขข้อมูลส่วนบุคคล"
            article="มาตรา 36"
            desc="ขอให้ดำเนินการแก้ไขข้อมูลให้ถูกต้อง เป็นปัจจุบัน สมบูรณ์ และไม่ก่อให้เกิดความเข้าใจผิด"
          />
          <RightCard
            icon={Trash2}
            title="สิทธิในการขอให้ลบหรือทำลายข้อมูล"
            article="มาตรา 33"
            desc="ขอให้ลบ ทำลาย หรือทำให้ข้อมูลไม่สามารถระบุตัวบุคคลได้ ในกรณีที่กฎหมายกำหนด"
          />
          <RightCard
            icon={Ban}
            title="สิทธิในการเพิกถอนความยินยอม"
            article="มาตรา 19 วรรคห้า"
            desc="เพิกถอนความยินยอมที่ได้ให้ไว้ในเวลาใดก็ได้ โดยแจ้งความประสงค์มายังเทศบาลฯ"
          />
        </div>

        <p className="max-w-3xl text-sm leading-loose text-[var(--muted-foreground)]">
          การเพิกถอนความยินยอมจะไม่กระทบต่อการเก็บรวบรวม ใช้
          หรือเปิดเผยข้อมูลส่วนบุคคลที่ท่านได้ให้ความยินยอมไว้แล้วโดยชอบ
          ก่อนการเพิกถอนความยินยอมนั้น
        </p>

        <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
          <div className="bg-[var(--muted)]/50 px-5 sm:px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-base font-bold text-[var(--foreground)]">
              วิธีการใช้สิทธิ
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
              ท่านสามารถใช้สิทธิข้างต้นได้ โดยปฏิบัติตาม 3 ขั้นตอน ดังนี้
            </p>
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
              desc="เทศบาลฯ จะดำเนินการและแจ้งผลให้ท่านทราบภายใน 30 วัน นับแต่วันที่ได้รับคำขอ"
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
        icon={Lock}
        alt
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
        icon={Cookie}
      >
        <ul className="space-y-2.5 list-none m-0 p-0">
          {[
            'เพื่อรักษาสถานะการเข้าสู่ระบบของท่าน',
            'เพื่อจดจำการตั้งค่าภาษาที่ท่านเลือก',
            'เพื่อจัดเก็บสถานะการกรอกข้อมูลในแบบฟอร์มเป็นการชั่วคราว',
          ].map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-white border border-[var(--border)] px-4 py-3 text-[15px] leading-relaxed text-[var(--foreground)]"
            >
              <CheckCircle2
                className="mt-1 h-4 w-4 flex-shrink-0 text-[var(--primary)]"
                aria-hidden
              />
              {t}
            </li>
          ))}
        </ul>
        <Callout tone="success" icon={CheckCircle2} title="ข้อสงวน">
          <p>
            เทศบาลฯ ไม่ใช้คุกกี้เพื่อการโฆษณา
            และไม่อนุญาตให้บุคคลภายนอกฝังการติดตามผ่านเว็บไซต์
          </p>
        </Callout>

        <p className="max-w-3xl text-[15px] leading-loose text-[var(--muted-foreground)]">
          ท่านสามารถปิดการใช้งานคุกกี้ได้ที่การตั้งค่าของเว็บเบราว์เซอร์
          อย่างไรก็ตาม การปิดคุกกี้อาจส่งผลให้บางส่วนของระบบทำงานไม่สมบูรณ์
        </p>
      </ContentSection>

      {/* ============================================================
         08 — ช่องทางการติดต่อ
         ============================================================ */}
      <section
        id="contact"
        className="scroll-mt-24 bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[12px] font-bold tabular-nums tracking-[0.2em] opacity-80">
              08
            </span>
            <span className="h-px flex-1 bg-white/20" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.3] [text-wrap:balance]">
            ช่องทางการติดต่อ
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] sm:text-base leading-loose opacity-90">
            ในกรณีที่ท่านมีข้อสงสัยเกี่ยวกับประกาศฉบับนี้
            หรือประสงค์จะใช้สิทธิตามที่กำหนด
            สามารถติดต่อผู้ควบคุมข้อมูลส่วนบุคคลได้ตามช่องทางดังต่อไปนี้
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-base font-bold">ติดต่อเทศบาลฯ</h3>
              </div>
              <p className="text-[15px] leading-loose opacity-95">
                เทศบาลนครหัวหิน
                <br />
                ศูนย์ประสานงานรักษาความสงบเรียบร้อยและความปลอดภัย ชั้น 3
                <br />
                อำเภอหัวหิน จังหวัดประจวบคีรีขันธ์
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <PhoneCall className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-base font-bold">โทรศัพท์</h3>
              </div>
              <a
                href="tel:032511047"
                className="text-xl sm:text-2xl font-bold tracking-wide tabular-nums underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                0-3251-1047 ต่อ 310
              </a>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                ติดต่อในวันและเวลาราชการ จันทร์ถึงศุกร์
              </p>
            </div>
          </div>

          <div className="mt-8">
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
      <div className="bg-[var(--muted)]/30 border-t border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-center text-xs sm:text-[13px] leading-loose text-[var(--muted-foreground)]">
            ประกาศฉบับนี้อาจมีการแก้ไขปรับปรุงให้สอดคล้องกับกฎหมายและการให้บริการของเทศบาลฯ
            ที่เปลี่ยนแปลงไป กรณีที่มีการเปลี่ยนแปลงในสาระสำคัญ
            เทศบาลฯ จะแจ้งให้ท่านทราบ
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
  icon: Icon,
  alt = false,
  children,
}: {
  id: string
  num: string
  title: string
  summary: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  alt?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${alt ? 'bg-[var(--muted)]/30' : 'bg-white'}`}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="flex items-center gap-4 mb-5">
          <span className="text-[12px] font-bold tabular-nums tracking-[0.2em] text-[var(--primary)]">
            {num}
          </span>
          <span className="h-px flex-1 bg-[var(--border)]" />
          <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden />
        </div>
        <h2 className="max-w-4xl text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold leading-[1.35] text-[var(--foreground)] [text-wrap:balance]">
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-base sm:text-[17px] leading-loose text-[var(--muted-foreground)] [text-wrap:pretty]">
          {summary}
        </p>
        <div className="mt-10 space-y-10 sm:space-y-12">{children}</div>
      </div>
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
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[var(--border)]">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
          {label}
        </h3>
      </div>
      <ul className="space-y-2.5 text-sm leading-loose text-[var(--foreground)] m-0 p-0 list-none">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="mt-2.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--primary)]"
              aria-hidden
            />
            <span>{it}</span>
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
      className="rounded-2xl border-2 p-5 sm:p-6"
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
          <h3 className="flex min-h-9 items-center text-[15px] font-bold leading-snug text-[var(--foreground)]">
            {title}
          </h3>
          <div className="mt-3 max-w-3xl text-[14px] leading-loose text-[var(--foreground)] [text-wrap:pretty]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function LegalBasis({
  label,
  article,
  desc,
}: {
  label: string
  article: string
  desc: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
      <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--primary)]">
        {article}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
        {label}
      </p>
      <p className="mt-2 text-[13px] leading-loose text-[var(--muted-foreground)]">
        {desc}
      </p>
    </div>
  )
}

function RetentionBox({
  num,
  unit,
  desc,
}: {
  num: string
  unit: string
  desc: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl sm:text-5xl font-bold leading-none tracking-tight text-[var(--primary)] tabular-nums">
          {num}
        </span>
        <span className="text-base font-semibold text-[var(--muted-foreground)]">
          {unit}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-loose text-[var(--muted-foreground)] [text-wrap:pretty]">
        {desc}
      </p>
    </div>
  )
}

function ShareItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 h-full">
      <p className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-loose text-[var(--muted-foreground)]">
        {desc}
      </p>
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
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 hover:border-[var(--primary)]/40 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--success)]/12 text-[var(--success)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--primary)]">
            {article}
          </p>
          <h3 className="mt-1 text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
            {title}
          </h3>
          <p className="mt-2 text-[13px] leading-loose text-[var(--muted-foreground)] [text-wrap:pretty]">
            {desc}
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  desc,
}: {
  n: string
  title: string
  desc: string
}) {
  return (
    <li className="flex items-start gap-4 px-5 sm:px-6 py-5">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-bold tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold leading-snug text-[var(--foreground)] [text-wrap:balance]">
          {title}
        </h4>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-loose text-[var(--muted-foreground)] [text-wrap:pretty]">
          {desc}
        </p>
      </div>
    </li>
  )
}

function SecurityItem({ desc }: { desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white border border-[var(--border)] px-4 py-3.5">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-[14px] leading-loose text-[var(--foreground)] [text-wrap:pretty]">
        {desc}
      </span>
    </div>
  )
}
