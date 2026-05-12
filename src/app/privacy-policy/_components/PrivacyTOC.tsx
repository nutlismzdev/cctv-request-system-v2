'use client'

import { useEffect, useState } from 'react'

type Section = { id: string; num: string; title: string; lead?: string }

export default function PrivacyTOC({ sections }: { sections: ReadonlyArray<Section> }) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])

  return (
    <nav aria-label="สารบัญ" className="cctv-toc">
      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--muted-foreground)] px-3 pb-2 pt-1">
        สารบัญ
      </div>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={'cctv-toc-item ' + (active === s.id ? 'active' : '')}
          onClick={() => setActive(s.id)}
        >
          <span className="cctv-toc-num">{s.num}</span>
          <span className="flex-1 min-w-0 truncate">{s.title}</span>
        </a>
      ))}
    </nav>
  )
}
