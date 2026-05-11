'use client'

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentProps } from 'react'
import { THEME_COLORS } from '@/lib/theme-colors'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface MenuItem {
  key: 'submitRequest' | 'checkStatus' | 'contact'
  href: string
  /** ถ้า true → active เฉพาะ path ตรงเป๊ะ (กันพ่อ-ลูกชนกัน เช่น /request กับ /request/status) */
  exact?: boolean
}

const MENU_ITEMS: readonly MenuItem[] = [
  { key: 'submitRequest', href: '/request', exact: true },
  { key: 'checkStatus', href: '/request/status' },
  { key: 'contact', href: '/contract' },
]

function isActive(pathname: string, item: MenuItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export const NavMenu = (props: ComponentProps<typeof NavigationMenu>) => {
  const t = useTranslations('navbar')
  const pathname = usePathname() ?? '/'

  const baseClass = 'font-medium px-3 py-2 rounded-md transition-colors'
  const inactiveClass = `${THEME_COLORS.foreground} hover:text-[var(--primary)] hover:bg-[var(--muted)]`
  const activeClass =
    'text-[var(--primary)] font-semibold bg-[var(--muted)] border border-[var(--border)]'

  return (
    <NavigationMenu {...props}>
      <NavigationMenuList className="gap-6 space-x-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start data-[orientation=vertical]:justify-start">
        {MENU_ITEMS.map((item) => {
          const active = isActive(pathname, item)
          return (
            <NavigationMenuItem key={item.key}>
              <NavigationMenuLink asChild>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(baseClass, active ? activeClass : inactiveClass)}
                >
                  {t(item.key)}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
