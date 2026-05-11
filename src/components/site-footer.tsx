// src/components/site-footer.tsx
//
// Footer ที่แสดงทุกหน้าของเว็บไซต์ (ยกเว้น admin / login / LIFF)
// บังคับมีลิงก์ Privacy Policy ตามข้อกำหนด PDPA — เข้าถึงได้ตลอดเวลา ทุกหน้า

import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, Phone, MapPin, ExternalLink } from 'lucide-react'
import { PDPA_PRIVACY_NOTICE_VERSION } from '@/lib/pdpa'

const CURRENT_YEAR = new Date().getFullYear()
const BUDDHIST_YEAR = CURRENT_YEAR + 543

export function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="mt-12 border-t-2 border-[var(--border)] bg-[var(--muted)]/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top — 3 columns on desktop */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-[var(--primary)]">
                <Image
                  src="/logo/1_0.ico"
                  alt="เทศบาลนครหัวหิน"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-[var(--foreground)]">
                  เทศบาลนครหัวหิน
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  ระบบยื่นคำร้องขอข้อมูลจากกล้องวงจรปิด (CCTV)
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              ระบบนี้ดำเนินการภายใต้ความรับผิดชอบของเทศบาลนครหัวหิน
              เพื่อให้บริการแก่ประชาชนตามภารกิจสาธารณะ
            </p>
          </div>

          {/* Quick links */}
          <nav aria-label="ลิงก์หลัก" className="text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              ลิงก์หลัก
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-[var(--foreground)] hover:text-[var(--primary)] hover:underline underline-offset-4"
                >
                  หน้าหลัก
                </Link>
              </li>
              <li>
                <Link
                  href="/request"
                  className="text-[var(--foreground)] hover:text-[var(--primary)] hover:underline underline-offset-4"
                >
                  ยื่นคำร้องออนไลน์
                </Link>
              </li>
              <li>
                <Link
                  href="/request/status"
                  className="text-[var(--foreground)] hover:text-[var(--primary)] hover:underline underline-offset-4"
                >
                  ตรวจสอบสถานะคำร้อง
                </Link>
              </li>
              <li>
                <Link
                  href="/contract"
                  className="text-[var(--foreground)] hover:text-[var(--primary)] hover:underline underline-offset-4"
                >
                  ติดต่อราชการ
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact */}
          <div className="text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              ติดต่อ
            </h2>
            <ul className="space-y-2 text-[var(--foreground)]">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                <span className="leading-snug">
                  เทศบาลนครหัวหิน อ.หัวหิน
                  <br />
                  จ.ประจวบคีรีขันธ์
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                <a
                  href="tel:032511047"
                  className="hover:text-[var(--primary)] hover:underline underline-offset-4 tabular-nums"
                >
                  0-3251-1047 ต่อ 310
                </a>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                <a
                  href="https://www.huahin.go.th/new/frontpage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--primary)] hover:underline underline-offset-4"
                >
                  www.huahin.go.th
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* PDPA banner — สำคัญ */}
        <div className="mt-8 rounded-xl border border-[var(--primary)]/15 bg-[var(--primary)]/[0.04] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  คุ้มครองข้อมูลส่วนบุคคลตาม PDPA
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                  · เวอร์ชันประกาศ {PDPA_PRIVACY_NOTICE_VERSION}
                </p>
              </div>
            </div>
            <Link
              href="/privacy-policy"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[var(--primary)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
            >
              อ่านประกาศความเป็นส่วนตัว
            </Link>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-6 flex flex-col items-start gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {BUDDHIST_YEAR} เทศบาลนครหัวหิน · สงวนลิขสิทธิ์
          </p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <li>
              <Link
                href="/privacy-policy"
                className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline underline-offset-4"
              >
                นโยบายความเป็นส่วนตัว
              </Link>
            </li>
            <li aria-hidden className="text-[var(--border)]">
              ·
            </li>
            <li>
              <Link
                href="/contract"
                className="hover:text-[var(--primary)] hover:underline underline-offset-4"
              >
                ติดต่อหน่วยงาน
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
