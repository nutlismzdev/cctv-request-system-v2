'use client'

import {useRouter} from 'next/navigation'
import {useLocale} from 'next-intl'

function setLocaleCookie(locale: 'th' | 'en') {
  const maxAge = 60 * 60 * 24 * 180 // 180 วัน
  document.cookie = `locale=${locale}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
}

type Size = 'sm' | 'md'

// 🎯 พาเล็ตสีแดงฝั่งตรงข้ามกับ #005581 (เข้มพอสำหรับปุ่ม)
const DESTRUCTIVE = {
  base: '#E45F2B',   // hsl(19, ~80%, ~54%)
  hover: '#CC4F26',  // เข้มลงสำหรับ hover
  text: '#FFFFFF'
}

export function LocaleSwitcherSegment({size = 'md'}: {size?: Size}) {
  const router = useRouter()
  const locale = (useLocale() as 'th' | 'en') ?? 'th'

  const isTH = locale === 'th'
  const isEN = locale === 'en'

  const h = size === 'sm' ? 'h-8' : 'h-9'
  const text = size === 'sm' ? 'text-[13px]' : 'text-sm'
  const pad = size === 'sm' ? 'px-3' : 'px-3.5'

  const setTo = (l: 'th' | 'en') => {
    if (l === locale) return
    setLocaleCookie(l)
    router.refresh()
  }

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={`inline-flex items-center rounded-full border bg-background ${h} ${text} p-0.5`}
      style={{minWidth: 96}} // กัน layout shift
    >
      <button
        type="button"
        aria-pressed={isTH}
        onClick={() => setTo('th')}
        className={`${pad} ${h} rounded-full transition font-medium`}
        style={
          isTH
            ? { backgroundColor: DESTRUCTIVE.base, color: DESTRUCTIVE.text }
            : {}
        }
        onMouseEnter={(e) => {
          if (isTH) (e.currentTarget as HTMLButtonElement).style.backgroundColor = DESTRUCTIVE.hover
        }}
        onMouseLeave={(e) => {
          if (isTH) (e.currentTarget as HTMLButtonElement).style.backgroundColor = DESTRUCTIVE.base
        }}
      >
        TH
      </button>

      <button
        type="button"
        aria-pressed={isEN}
        onClick={() => setTo('en')}
        className={`${pad} ${h} rounded-full transition font-medium`}
        style={
          isEN
            ? { backgroundColor: DESTRUCTIVE.base, color: DESTRUCTIVE.text }
            : {}
        }
        onMouseEnter={(e) => {
          if (isEN) (e.currentTarget as HTMLButtonElement).style.backgroundColor = DESTRUCTIVE.hover
        }}
        onMouseLeave={(e) => {
          if (isEN) (e.currentTarget as HTMLButtonElement).style.backgroundColor = DESTRUCTIVE.base
        }}
      >
        EN
      </button>
    </div>
  )
}
