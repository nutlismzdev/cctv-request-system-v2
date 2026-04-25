'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from './navbar-04/logo'
import { NavMenu } from './navbar-04/nav-menu'
import { NavigationSheet } from './navbar-04/navigation-sheet'
import { LocaleSwitcherSegment } from '@/components/locale-switcher'
import { THEME_COLORS } from '@/lib/theme-colors'
import { useTranslations } from 'next-intl'

export function Navbar() {
  const t = useTranslations('navbar')

  return (
    <nav className={`fixed top-0 inset-x-0 h-16 bg-[var(--background)] border-b-2 ${THEME_COLORS.border} shadow-md z-50`}>
      <div className="h-full mx-auto px-4 max-w-6xl grid grid-cols-[auto_1fr_auto] items-center gap-3 pt-[env(safe-area-inset-top)]">
        {/* ซ้าย: โลโก้ */}
        <div className="flex items-center">
          <Logo />
        </div>

        {/* กลาง: เมนูเดสก์ท็อป */}
        <div className="hidden md:flex justify-center">
          <NavMenu />
        </div>

        {/* ขวา: สวิตช์ภาษา + ปุ่ม/เมนู */}
        <div className="flex items-center gap-2 justify-self-end">
          {/* มือถือใช้ขนาดเล็ก เดสก์ท็อปใช้ขนาดปกติ */}
          <span className="md:hidden"><LocaleSwitcherSegment size="sm" /></span>
          <span className="hidden md:inline"><LocaleSwitcherSegment size="md" /></span>

          {/* CTA: ซ่อนบนมือถือเพื่อไม่ให้แน่นเกิน */}
          <Button
            variant="outline"
            className={`hidden sm:inline-flex border-2 ${THEME_COLORS.border} text-[var(--primary)] font-semibold`}
            asChild
          >
            <Link href="/request">{t('submitRequest')}</Link>
          </Button>
          <Button
            className={`hidden sm:inline-flex ${THEME_COLORS.primary} ${THEME_COLORS.primaryForeground} font-semibold border-2 ${THEME_COLORS.border}`}
            asChild
          >
            <Link href="/request/status">{t('checkStatus')}</Link>
          </Button>

          {/* เมนูมือถือ */}
          <div className="md:hidden">
            <NavigationSheet />
          </div>
        </div>
      </div>
    </nav>
  )
}
