// src/app/api/geo/districts/route.ts
export const runtime = 'nodejs'

import { getAmphures, getProvinces, filterByNameTH } from '@/lib/thai-geo'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const provinceId = Number(searchParams.get('provinceId') || searchParams.get('province_id') || '0')
    const q = searchParams.get('q') || undefined
    const limit = Number(searchParams.get('limit') || '20')
    const lang = searchParams.get('lang') || 'th'

    if (!provinceId) {
      return Response.json(
        { success: false, message: 'Missing provinceId' },
        { status: 400 }
      )
    }

    const [provinces, amphures] = await Promise.all([getProvinces(), getAmphures()])
    const province = provinces.find((p) => p.id === provinceId)
    if (!province) {
      return Response.json({ success: false, message: 'Invalid provinceId' }, { status: 400 })
    }

    const list = amphures.filter((a) => a.province_id === provinceId)
    const items = filterByNameTH(list, q, limit).map((a) => ({
      id: a.id,
      name: lang === 'en' ? a.name_en : a.name_th,
      name_th: a.name_th,
      name_en: a.name_en,
      province_id: provinceId,
      province_name: lang === 'en' ? province.name_en : province.name_th,
      province_name_th: province.name_th,
      province_name_en: province.name_en,
    }))

    return Response.json({ success: true, items })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}
