// app/contact/page.tsx
'use client'
import {
  Building2,
  Phone,
  MapPin,
  Globe,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'



// ---------- Small pieces ----------
function FieldRow({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string | React.ReactNode
  hint?: string
  href?: string
}) {

  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 text-[var(--primary)] mt-0.5" aria-hidden>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
          {typeof value === 'string' ? (
            href ? (
              <a
                href={href}
                className="text-sm underline decoration-[var(--primary)] underline-offset-4 text-[var(--primary)] break-all"
              >
                {value}
              </a>
            ) : (
              <span className="text-sm text-[var(--foreground)] break-all">{value}</span>
            )
          ) : (
            value
          )}
        </div>
        {hint && <p className="text-xs text-[var(--muted-foreground)] mt-1">{hint}</p>}
      </div>
    </div>
  )
}

function HoursTable({ t }: { t: ReturnType<typeof useTranslations> }) {
  const rows: { day: string; time: string }[] = [
    { day: t('contract.hours.mondayToFriday.day'), time: t('contract.hours.mondayToFriday.time') },
    { day: t('contract.hours.weekend.day'), time: t('contract.hours.weekend.time') },
    { day: t('contract.hours.holiday.day'), time: t('contract.hours.holiday.time') },
  ]
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="grid grid-cols-2 bg-[var(--accent)]/40 text-[var(--foreground)] text-sm font-medium">
        <div className="px-3 py-2 border-r border-[var(--border)]">{t('contract.hours.day')}</div>
        <div className="px-3 py-2">{t('contract.hours.time')}</div>
      </div>
      <dl className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div key={r.day} className="grid grid-cols-2">
            <dt className="px-3 py-2 text-sm">{r.day}</dt>
            <dd className="px-3 py-2 text-sm">{r.time}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function MapCard({ t }: { t: ReturnType<typeof useTranslations> }) {
  // NOTE: ปรับ query ให้ตรงตำแหน่งจริงของหน่วยงาน
  const mapsUrl = `https://maps.app.goo.gl/meLk3HrxZcC7poSXA`
  const embedSrc = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3889.123456789012!2d99.95761743616974!3d12.56820310215239!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sqPRh27HrA1D-BFKbYM0nRw!2sเทศบาลนครหัวหิน!5e0!3m2!1sth!2sth!4v1758167872641!6m8!1m7!1sqPRh27HrA1D-BFKbYM0nRw!2m2!1d12.56820310215239!2d99.95761743616974!3f187.20460086118592!4f-0.20618885675159504!5f0.7820865974627469`
  return (
    <Card className="border-2 rounded-xl shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-[var(--foreground)]">{t('contract.map.title')}</CardTitle>
        <CardDescription className="text-sm text-[var(--muted-foreground)]">
          {t('contract.map.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-[var(--border)]">
          <iframe
            title={t('contract.map.title')}
            src={embedSrc}
            className="w-full h-full"
            loading="lazy"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <Button className="h-9">
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('contract.map.openButton')}
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Page ----------
export default function ContactPage() {
  const t = useTranslations()

  // ✅ แก้ไขข้อมูลจริงของหน่วยงานได้ตรงนี้
  const org = {
    name: t('contract.org.name'),
    unit: t('contract.org.unit'),
    address: t('contract.org.address'),
    telMain: t('contract.org.telMain'),
    website: 'https://www.huahin.go.th/new/frontpage',
    lineOA: 'cctv@huahin', // ตัวอย่าง
  }

  const telHref = `tel:${org.telMain.replace(/[^0-9+]/g, '')}`

  const siteHref = org.website

  return (
    <>

      {/* Decorative subtle background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background-image:radial-gradient(rgba(148,163,184,0.15)_1px,transparent_1px)] [background-size:14px_14px] [background-position:0_0]"
      />

      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Intro banner */}
        <section className="mb-8">
          <div className="rounded-xl border-2 border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              {t('contract.hero.title')}
            </h2>
            <p className="text-[var(--muted-foreground)] mt-2 text-sm sm:text-base">
              {t('contract.hero.description')}
            </p>
          </div>
        </section>

        {/* Layout */}
        <div className="grid grid-cols-12 gap-8">
          {/* Left column */}
          <section className="col-span-12 lg:col-span-7 space-y-8">
            {/* Contact summary card */}
            <Card className="border-2 rounded-xl shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[var(--foreground)]">{t('contract.contact.title')}</CardTitle>
                <CardDescription className="text-sm text-[var(--muted-foreground)]">
                  {t('contract.contact.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldRow
                  icon={<Building2 className="w-5 h-5" />}
                  label={t('contract.contact.fields.organization')}
                  value={
                    <span className="text-sm">
                      {org.name} • {org.unit}
                    </span>
                  }
                />
                <FieldRow
                  icon={<MapPin className="w-5 h-5" />}
                  label={t('contract.contact.fields.address')}
                  value={org.address}
                />
                <FieldRow
                  icon={<Phone className="w-5 h-5" />}
                  label={t('contract.contact.fields.phone')}
                  value={org.telMain}
                  href={telHref}
                />


                <FieldRow
                  icon={<Globe className="w-5 h-5" />}
                  label={t('contract.contact.fields.website')}
                  value={org.website}
                  href={siteHref}
                />
                <FieldRow
                  icon={<MessageSquare className="w-5 h-5" />}
                  label={t('contract.contact.fields.lineOA')}
                  value={org.lineOA}
                  href={`https://lin.ee/ucf9Nju`}
                  hint={t('contract.contact.fields.lineOAHint')}
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={telHref}>
                    <Button className="h-9">
                      <Phone className="w-4 h-4 mr-2" />
                      {t('contract.contact.buttons.call')}
                    </Button>
                  </a>

                  <a href={siteHref} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="h-9">
                      <Globe className="w-4 h-4 mr-2" />
                      {t('contract.contact.buttons.visitWebsite')}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Hours */}
            <Card className="border-2 rounded-xl shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[var(--foreground)]">{t('contract.hours.title')}</CardTitle>
                <CardDescription className="text-sm text-[var(--muted-foreground)]">
                  {t('contract.hours.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HoursTable t={t} />

              </CardContent>
            </Card>

            {/* PDPA & Accessibility */}
            <Card className="border-2 rounded-xl shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[var(--foreground)]">{t('contract.notes.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md bg-[var(--primary)]/5 border border-[var(--primary)]/20 p-3">
                  <p className="font-medium">{t('contract.notes.pdpa.title')}</p>
                  <p className="text-[var(--muted-foreground)] mt-1">
                    {t('contract.notes.pdpa.description')}
                  </p>
                </div>
                <div className="rounded-md bg-[var(--accent)]/30 border border-[var(--border)] p-3">
                  <p className="font-medium">{t('contract.notes.accessibility.title')}</p>
                  <p className="text-[var(--muted-foreground)] mt-1">
                    {t('contract.notes.accessibility.description')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Right column */}
          <aside className="col-span-12 lg:col-span-5 space-y-8" aria-label={t('contract.map.title')}>
            <MapCard t={t} />
          </aside>
        </div>
      </main>
    </>
  )
}
