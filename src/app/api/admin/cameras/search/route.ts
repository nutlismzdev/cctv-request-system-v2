// app/api/admin/cameras/search/route.ts
import { NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Database row interface for camera search results
interface CameraRow extends RowDataPacket {
  id: number
  camera_name: string
  area: string
  ip_address: string | null
  lat: number | null
  lng: number | null
}

// ——— normalize IP: ตัดช่องว่าง, ตัดจุดท้าย, ถ้าไม่ใช่ IPv4 -> null
function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null
  const x = ip.trim()
  if (!x) return null
  const trimmed = x.endsWith('.') ? x.slice(0, -1) : x
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
  return ipv4.test(trimmed) ? trimmed : null
}

type DbCam = {
  id: number
  camera_name: string
  area: string
  ip_address: string | null
  // NOTE: ตัด status ออกไม่ใช้งาน แต่ยัง select ได้ถ้าจำเป็น
  lat?: number | null
  lng?: number | null
}

type LiveCam = {
  id?: string
  camera_name?: string
  ip_address?: string
  isOnline?: boolean
  ok?: boolean
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const area = (url.searchParams.get('area') || '').trim()
  const wantLive = url.searchParams.get('live') === '1'

  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    // 1) ค้นหาจากฐาน — ไม่ใช้ / ไม่กรอง status จากฐานอีกต่อไป
    const where: string[] = []
    const params: string[] = []

    // คีย์เวิร์ด: area / camera_name / ip
    where.push(`(c.area LIKE ? OR c.camera_name LIKE ? OR c.ip_address LIKE ?)`)
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)

    if (area) {
      where.push(`c.area = ?`)
      params.push(area)
    }

    const sql = `
      SELECT c.id, c.camera_name, c.area, c.ip_address, c.lat, c.lng
      FROM cctv c
      WHERE ${where.length ? where.join(' AND ') : '1=1'}
      ORDER BY c.area, c.camera_name
      LIMIT 100
    `
    const [dbRows] = await getPool().execute<CameraRow[]>(sql, params)
    const dbCams: DbCam[] = dbRows || []

    // 2) ถ้าขอสถานะสด ให้ดึงแล้ว map ด้วย IP ที่ normalize แล้วเท่านั้น (strict match)
    const liveByIp = new Map<string, LiveCam>()
    if (wantLive) {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 6000) // timeout 6s
        const liveRes = await fetch('https://api.itac-huahincity.com/api/status', {
          signal: ctrl.signal,
          cache: 'no-store',
          headers: { accept: 'application/json' },
          next: { revalidate: 0 },
        })
        clearTimeout(t)

        if (liveRes.ok) {
          const liveJson = await liveRes.json()
          const list: LiveCam[] = Array.isArray(liveJson?.cameras) ? liveJson.cameras : []
          for (const it of list) {
            const nip = normalizeIp(it.ip_address ?? '')
            if (!nip) continue // IP ว่าง/ผิดรูปแบบ ข้ามไป
            const normalized: LiveCam = {
              ...it,
              isOnline: typeof it.isOnline === 'boolean' ? it.isOnline : it.ok,
              ok: typeof it.isOnline === 'boolean' ? it.isOnline : it.ok,
            }
            liveByIp.set(nip, normalized)
          }
        }
      } catch {
        // ถ้าดึงสดพลาด ให้แค่ไม่มีสถานะสด (ไม่ล้มทั้งคำขอ)
      }
    }

    // 3) รวมผล: ใช้เฉพาะสถานะสด (ถ้ามี) — ไม่ส่ง status จากฐาน
    const merged = dbCams.map((r) => {
      const nip = normalizeIp(r.ip_address)
      const liveHit = nip ? liveByIp.get(nip) : undefined

      const isOnline =
        liveHit && typeof liveHit.isOnline === 'boolean'
          ? liveHit.isOnline
          : undefined

      return {
        id: r.id,
        camera_name: r.camera_name,
        area: r.area,
        ip_address: r.ip_address,
        lat: r.lat,
        lng: r.lng,

        // สถานะสดเท่านั้น
        isOnline,        // boolean | undefined
        ok: isOnline,    // เผื่อ UI เดิมอ้าง ok
        liveSource: isOnline === undefined ? 'none' : 'live' as const,
      }
    })

    return NextResponse.json({ success: true, data: merged })
  } catch (e: unknown) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
