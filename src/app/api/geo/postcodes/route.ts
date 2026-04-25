// src/app/api/geo/postcodes/route.ts
export const runtime = 'nodejs'

import {
  getProvinces,
  getAmphures,
  getTambons,
  filterByNameTH,
} from '@/lib/thai-geo'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const subdistrictId = Number(searchParams.get('subdistrictId') || searchParams.get('tambon_id') || '0')
    const q = searchParams.get('q') || undefined
    const limit = Number(searchParams.get('limit') || '10')
    const lang = searchParams.get('lang') || 'th'

    const [provinces, amphures, tambons] = await Promise.all([
      getProvinces(),
      getAmphures(),
      getTambons(),
    ])

    let list = tambons

    if (subdistrictId) {
      list = list.filter((t) => t.id === subdistrictId)
    } else if (q) {
      list = filterByNameTH(list, q, limit)
    } else {
      list = list.slice(0, limit)
    }

    // join หาชื่ออำเภอ/จังหวัด
    const amphureById = new Map(amphures.map((a) => [a.id, a]))
    const provinceById = new Map(provinces.map((p) => [p.id, p]))

    const items = list.map((t) => {
      const a = amphureById.get(t.amphure_id)
      const p = a ? provinceById.get(a.province_id) : undefined
      return {
        subdistrict_id: t.id,
        subdistrict_name: lang === 'en' ? t.name_en : t.name_th,
        subdistrict_name_th: t.name_th,
        subdistrict_name_en: t.name_en,
        district_id: a?.id ?? null,
        district_name: lang === 'en' ? a?.name_en : a?.name_th,
        district_name_th: a?.name_th ?? null,
        district_name_en: a?.name_en ?? null,
        province_id: p?.id ?? null,
        province_name: lang === 'en' ? p?.name_en : p?.name_th,
        province_name_th: p?.name_th ?? null,
        province_name_en: p?.name_en ?? null,
        zip_code: t.zip_code,
      }
    })

    return Response.json({ success: true, items })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}
