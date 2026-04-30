// next.config.ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// ชี้ไปที่ไฟล์โหลดข้อความภาษา (เราสร้างไว้ที่ src/i18n/request.ts)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  experimental: {
    // ตัด barrel imports ของ libraries ที่ใช้ทั่วโปรเจกต์ — ลด cold start 200-800ms,
    // ลดเวลา dev boot 15-70%, build เร็วขึ้น ~28%
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'sonner',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
      },
    ],
  },

  async headers() {
    return [
      {
        // แมตช์ไฟล์ทั้งหมดในโฟลเดอร์ /uploads
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
