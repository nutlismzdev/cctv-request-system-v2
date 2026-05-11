// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import { ConditionalNavbar } from '@/components/conditional-navbar'
import { ConditionalFooter } from '@/components/conditional-footer'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale, setRequestLocale } from 'next-intl/server'
import './globals.css'

const sarabun = localFont({
  src: [
    { path: '../../public/font/sarabun/Sarabun-Regular.ttf',  weight: '400', style: 'normal' },
    { path: '../../public/font/sarabun/Sarabun-Medium.ttf',   weight: '500', style: 'normal' },
    { path: '../../public/font/sarabun/Sarabun-SemiBold.ttf', weight: '600', style: 'normal' },
  ],
  variable: '--font-sarabun',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'เทศบาลนครหัวหิน — ระบบยื่นคำร้อง',
  description: 'ระบบยื่นคำร้องขอภาพจากกล้อง CCTV เทศบาลนครหัวหิน',
  applicationName: 'CCTV Hua Hin',
  authors: [{ name: 'เทศบาลนครหัวหิน' }],
  creator: 'เทศบาลนครหัวหิน',
  publisher: 'เทศบาลนครหัวหิน',
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'เทศบาลนครหัวหิน — ระบบยื่นคำร้อง',
    description: 'ระบบยื่นคำร้องขอภาพจากกล้อง CCTV เทศบาลนครหัวหิน',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'เทศบาลนครหัวหิน — ระบบยื่นคำร้อง',
    description: 'ระบบยื่นคำร้องขอภาพจากกล้อง CCTV เทศบาลนครหัวหิน',
  },
  icons: {
    icon: [
      { url: '/logo/1_0.ico', sizes: 'any' },
      { url: '/logo/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/logo/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: '/logo/1_0.ico',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CCTV Hua Hin',
    startupImage: [
      {
        url: '/logo/icon-512.png',
        media: '(device-width: 768px) and (device-height: 1024px)',
      },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${sarabun.className} ${sarabun.variable} antialiased text-[15px] md:text-[16px] bg-background text-foreground`}>
        <NextIntlClientProvider messages={messages}>
          <ConditionalNavbar />
          {children}
          <ConditionalFooter />
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
