// next.config.ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// ชี้ไปที่ไฟล์โหลดข้อความภาษา (เราสร้างไว้ที่ src/i18n/request.ts)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  /* ใส่ options อื่นๆ ได้ตามต้องการ */

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
      {
        // เสิร์ฟไฟล์ผ่าน API routes
        source: '/api/files/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
