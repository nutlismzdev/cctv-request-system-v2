'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle2, MessageCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Suspense } from 'react'
import Image from 'next/image'
import { THEME_COLORS } from '@/lib/theme-colors'
import { useTranslations } from 'next-intl'

/** กรอบ QR + ภาพ ที่ทำให้ "กรอบ = ภาพ + padding" เสมอ */
function QRFrame({
  src,
  alt,
  size,
  padding = 12, // px
  className = '',
}: {
  src: string
  alt: string
  size: number // ความกว้าง/สูงของกรอบ (px)
  padding?: number // ระยะห่างภาพกับกรอบ (px)
  className?: string
}) {
  return (
    <div
      className={`relative rounded-lg border-2 border-dashed ${THEME_COLORS.muted} ${THEME_COLORS.border} ${className}`}
      style={{ width: size, height: size, padding }}
    >
      <Image
        src={src}
        alt={alt}
        width={size - padding * 2}
        height={size - padding * 2}
        className="rounded"
      />
    </div>
  )
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const t = useTranslations('success')
  const reportId = searchParams.get('id') || t('unknownReportId')
  const trackingToken = searchParams.get('token')

  return (
    <div className={`relative min-h-screen overflow-hidden ${THEME_COLORS.background}`}>
      {/* BG ลายจุดนุ่ม ๆ ทางการ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          [background-image:radial-gradient(rgba(148,163,184,0.25)_1px,transparent_1px)]
          [background-size:14px_14px] [background-position:0_0]"
      />

      {/* คอนเทนเนอร์ให้ตรงกับ navbar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-12">
        {/* ----------------------- Mobile Layout ----------------------- */}
        <div className="md:hidden">
          <div className="mx-auto max-w-sm">
            {/* Header Success - Mobile */}
            <div className="text-center mb-4">
              <div
                className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${THEME_COLORS.muted} ${THEME_COLORS.border}`}
              >
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className={`text-xl font-bold ${THEME_COLORS.foreground} mb-2`}>{t('title')}</h1>
              <p className={`text-sm ${THEME_COLORS.mutedForeground}`}>{t('subtitle')}</p>
        
            </div>

            {/* LINE Card - Mobile */}
            <Card className={`${THEME_COLORS.card} ${THEME_COLORS.border} shadow-lg border`}>
              <CardContent className="p-4">
                <div className="text-center ">

                  <h2 className={`text-lg font-bold ${THEME_COLORS.foreground}`}>{t('lineTitle')}</h2>
                </div>

                <div className="text-center space-y-4">
                  {/* QR: กรอบ = 176px, padding 10px => รูปจะพอดีภายใน */}
                  <QRFrame
                    src="/qrcode/M_513dlddc_BW.png"
                    alt="LINE QR Code"
                    size={176}   // เท่ากับ w-44/h-44 เดิม
                    padding={10} // ปรับได้ 8–12 ตามใจ
                    className="mx-auto"
                  />

                  {/* ปุ่มเชื่อมต่อกับ LINE OA - รวมทั้งการเพิ่มเพื่อนและผูกคำร้อง */}
                  <div className="space-y-2 mt-4">
                    {trackingToken ? (
                      <Link href={`/liff/link?report_id=${reportId}&t=${trackingToken}`}>
                        <Button
                          className={`w-full h-10 text-sm font-semibold ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground} shadow-md`}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          {t('addLineFriend')}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className={`w-full h-10 text-sm font-semibold ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground} shadow-md`}
                        onClick={() => window.open('https://line.me/R/ti/p/@513dlddc', '_blank')}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {t('addLineFriend')}
                      </Button>
                    )}
                    <p className={`text-xs text-center ${THEME_COLORS.mutedForeground}`}>
                      {trackingToken ? t('connectNotification') : ''}
                    </p>
                  </div>


                  <div className="space-y-2">
                    <h3 className={`text-base font-bold ${THEME_COLORS.foreground}`}>{t('lineAccountName')}</h3>
                    <p className={`text-xs ${THEME_COLORS.mutedForeground} leading-relaxed`}>
                      {t('scanQrDescription')}
                    </p>
                  </div>
                </div>

                <div className={`mt-6 p-3 ${THEME_COLORS.muted} rounded-md border ${THEME_COLORS.border}`}>
                  <h4 className={`font-semibold ${THEME_COLORS.foreground} mb-2 text-sm`}>{t('benefitsTitle')}</h4>
                  <ul className={`text-xs ${THEME_COLORS.mutedForeground} space-y-1.5`}>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1 h-1 ${THEME_COLORS.primary} rounded-full mt-1.5 mr-2 flex-shrink-0`}
                      ></span>
                      {t('benefit1')}
                    </li>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1 h-1 ${THEME_COLORS.primary} rounded-full mt-1.5 mr-2 flex-shrink-0`}
                      ></span>
                      {t('benefit2')}
                    </li>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1 h-1 ${THEME_COLORS.primary} rounded-full mt-1.5 mr-2 flex-shrink-0`}
                      ></span>
                      {t('benefit3')}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons - Mobile */}
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/request">
                <Button
                  variant="outline"
                  className={`w-full h-9 text-sm ${THEME_COLORS.border} hover:${THEME_COLORS.accent} border`}
                >
                  <ArrowLeft className="w-4 h-4 mr-2 relative top-[5px]" />
                  {t('newRequest')}
                </Button>
              </Link>
            </div>

            {/* Footer Note - Mobile */}
            <div className="mt-6 text-center">
              <p className={`text-xs ${THEME_COLORS.mutedForeground} leading-relaxed`}>
                {t('footerNote')}
              </p>
            </div>
          </div>
        </div>

        {/* ----------------------- Desktop Layout ---------------------- */}
        <div className="hidden md:block">
          <div className="mx-auto max-w-lg">
            {/* Header Success - Desktop */}
            <div className="text-center mb-6">
              <div
                className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${THEME_COLORS.muted} ${THEME_COLORS.border}`}
              >
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h1 className={`text-2xl font-bold ${THEME_COLORS.foreground} mb-2`}>{t('title')}</h1>
              <p className={`text-base ${THEME_COLORS.mutedForeground}`}>{t('subtitle')}</p>
      
            </div>

            {/* LINE Card - Desktop */}
            <Card className={`${THEME_COLORS.card} ${THEME_COLORS.border} shadow-lg border`}>
              <CardContent className="p-5">
              <div className="text-center ">

                <h2 className={`text-lg font-bold ${THEME_COLORS.foreground}`}>{t('lineTitle')}</h2>
                </div>

                <div className="text-center space-y-5">
                  {/* QR: กรอบ = 208px, padding 12px */}
                  <QRFrame
                    src="/qrcode/M_513dlddc_BW.png"
                    alt="LINE QR Code"
                    size={208}   // เท่ากับ w-52/h-52 เดิม
                    padding={12}
                    className="mx-auto"
                  />

                  {/* ปุ่มเชื่อมต่อกับ LINE OA - รวมทั้งการเพิ่มเพื่อนและผูกคำร้อง */}
                  <div className="space-y-2 mt-4">
                    {trackingToken ? (
                      <Link href={`/liff/link?report_id=${reportId}&t=${trackingToken}`}>
                        <Button
                          className={`w-full h-11 text-sm font-semibold ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground} shadow-md`}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          {t('addLineFriend')}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className={`w-full h-11 text-sm font-semibold ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground} shadow-md`}
                        onClick={() => window.open('https://line.me/R/ti/p/@513dlddc', '_blank')}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {t('addLineFriend')}
                      </Button>
                    )}
                    <p className={`text-xs text-center ${THEME_COLORS.mutedForeground}`}>
                      {trackingToken ? t('connectNotification') : ''}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className={`text-base font-bold ${THEME_COLORS.foreground}`}>{t('lineAccountName')}</h3>
                    <p className={`text-xs ${THEME_COLORS.mutedForeground} leading-relaxed`}>
                      {t('scanQrDescription')}
                    </p>
                  </div>
                </div>

                 
        

                <div className={`mt-6 p-4 ${THEME_COLORS.muted} rounded-md border ${THEME_COLORS.border}`}>
                  <h4 className={`font-semibold ${THEME_COLORS.foreground} mb-3 text-sm`}>{t('benefitsTitle')}</h4>
                  <ul className={`text-sm ${THEME_COLORS.mutedForeground} space-y-2`}>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1.5 h-1.5 ${THEME_COLORS.primary} rounded-full mt-2 mr-3 flex-shrink-0`}
                      ></span>
                      {t('benefit1')}
                    </li>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1.5 h-1.5 ${THEME_COLORS.primary} rounded-full mt-2 mr-3 flex-shrink-0`}
                      ></span>
                      {t('benefit2')}
                    </li>
                    <li className="flex items-start">
                      <span
                        className={`inline-block w-1.5 h-1.5 ${THEME_COLORS.primary} rounded-full mt-2 mr-3 flex-shrink-0`}
                      ></span>
                      {t('benefit3')}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons - Desktop */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button
                  variant="outline"
                  className={`w-full sm:w-auto h-10 ${THEME_COLORS.border} hover:${THEME_COLORS.accent} border`}
                >
                  <ArrowLeft className="w-4 h-4 mr-2 relative top-[5px]" />
                  {t('newRequest')}
                </Button>
              </Link>
            </div>

            {/* Footer Note - Desktop */}
            <div className="mt-8 text-center">
              <p className={`text-sm ${THEME_COLORS.mutedForeground} leading-relaxed`}>
                {t('footerNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  const t = useTranslations('success')

  return (
    <div className={`relative min-h-screen ${THEME_COLORS.background}`}>
      {/* ใช้พื้นหลังเดียวกับหน้าจริงตอนโหลด */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          [background-image:radial-gradient(rgba(148,163,184,0.25)_1px,transparent_1px)]
          [background-size:14px_14px] [background-position:0_0]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
          bg-[radial-gradient(circle_600px_at_10%_0%,rgba(59,130,246,0.12),transparent_60%),
              radial-gradient(circle_600px_at_90%_100%,rgba(16,185,129,0.12),transparent_60%)]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-12">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${THEME_COLORS.primary} mx-auto mb-4`}></div>
          <p className={`${THEME_COLORS.mutedForeground}`}>{t('loading')}</p>
        </div>
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
