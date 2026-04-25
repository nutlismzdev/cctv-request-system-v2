// app/api/admin/cameras/status/route.ts
import { NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// แถวจากฐานข้อมูล cctv
interface CameraRow extends RowDataPacket {
  id: number
  camera_name: string
  area: string
  ip_address: string | null
  status: 'active' | 'unactive' | null
  lat: number | null
  lng: number | null
}

// รูปแบบข้อมูลจาก API ภายนอก
type ExternalStatus = {
  status: 'success' | string
  cameras: Array<{
    id: string
    camera_name: string
    ip_address: string
    isOnline: boolean
    ok?: boolean
    usedHost?: string
    method?: string
    stream_urls?: Record<string, string>
  }>
}

// helper: ทำให้ IP อยู่ในรูปที่ compare ได้ (trim/ lower)
function normalizeIp(ip: string | null | undefined) {
  return (ip ?? '').trim().toLowerCase()
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    // ตัวกรอง optional
    const area = url.searchParams.get('area') || ''
    const status = url.searchParams.get('status') as 'active' | 'unactive' | '' | null
    const withLive = url.searchParams.get('live') === '1'

    // 1) ดึงกล้องจากฐานข้อมูล
    const params: string[] = []
    const where: string[] = []
    if (area) {
      where.push('c.area = ?')
      params.push(area)
    }
    if (status === 'active' || status === 'unactive') {
      where.push('c.status = ?')
      params.push(status)
    }

    const sql = `
      SELECT
        c.id, c.camera_name, c.area,
        c.ip_address,
        c.status,
        c.lat, c.lng
      FROM cctv c
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.area, c.camera_name
      LIMIT 500
    `
    const [rows] = await getPool().execute<CameraRow[]>(sql, params)

    // map จาก DB
    const base = rows.map(r => ({
      id: r.id,
      camera_name: r.camera_name,
      area: r.area,
      ip_address: r.ip_address,         // อาจว่าง/รูปแบบไม่ครบ
      status: r.status,                 // active/unactive/null (fallback)
      lat: r.lat,
      lng: r.lng,
      // ช่อง real-time จะเติมด้านล่างเมื่อ withLive = true
      isOnline: undefined as boolean | undefined,
      ok: undefined as boolean | undefined,
    }))

    // 2) enrich real-time (optional)
    if (withLive) {
      try {
        const liveRes = await fetch('https://api.itac-huahincity.com/api/status', { cache: 'no-store' })
        if (liveRes.ok) {
          const liveJson = (await liveRes.json()) as ExternalStatus
          if (liveJson && Array.isArray(liveJson.cameras)) {
            // สร้าง map จาก IP -> กล้องสด
            const liveByIp = new Map<string, ExternalStatus['cameras'][number]>()
            for (const cam of liveJson.cameras) {
              const key = normalizeIp(cam.ip_address)
              if (!key) continue // ข้าม IP ว่าง/รูปแบบไม่ครบ
              // ตัวหลังทับตัวก่อน (โอเค; หรือจะเช็ค duplicate ก็ได้)
              liveByIp.set(key, cam)
            }

            // merge: อิง IP เป็นหลัก (ถ้า IP ว่างก็จะไม่มีการ merge ซึ่งเรายอมรับ)
            for (const item of base) {
              const key = normalizeIp(item.ip_address)
              if (!key) continue
              const live = liveByIp.get(key)
              if (live) {
                item.isOnline = !!live.isOnline
                item.ok = typeof live.ok === 'boolean' ? live.ok : undefined
              }
            }
          }
        }
      } catch (e) {
        // ถ้า API ภายนอกล่ม/ช้า -> fallback เงียบ ๆ
        console.warn('[cameras/status] live status fetch failed:', e)
      }
    }

    return NextResponse.json({ success: true, data: base })
  } catch (e: unknown) {
    console.error('[cameras/status] error:', e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
