// src/app/api/geo/subdistricts/route.ts
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
    const districtId = Number(searchParams.get('districtId') || searchParams.get('amphure_id') || '0')
    const q = searchParams.get('q') || undefined
    const limit = Number(searchParams.get('limit') || '20')
    const lang = searchParams.get('lang') || 'th'

    if (!districtId) {
      return Response.json(
        { success: false, message: 'Missing districtId' },
        { status: 400 }
      )
    }

    const [provinces, amphures, tambons] = await Promise.all([
      getProvinces(),
      getAmphures(),
      getTambons(),
    ])

    const amphure = amphures.find((a) => a.id === districtId)
    if (!amphure) {
      return Response.json({ success: false, message: 'Invalid districtId' }, { status: 400 })
    }
    const province = provinces.find((p) => p.id === amphure.province_id)

    const list = tambons.filter((t) => t.amphure_id === districtId)
    const items = filterByNameTH(list, q, limit).map((t) => ({
      id: t.id,
      name: lang === 'en' ? t.name_en : t.name_th,
      name_th: t.name_th,
      name_en: t.name_en,
      zip_code: t.zip_code,
      district_id: amphure.id,
      district_name: lang === 'en' ? amphure.name_en : amphure.name_th,
      district_name_th: amphure.name_th,
      district_name_en: amphure.name_en,
      province_id: province?.id ?? null,
      province_name: lang === 'en' ? province?.name_en : province?.name_th,
      province_name_th: province?.name_th ?? null,
      province_name_en: province?.name_en ?? null,
    }))

    return Response.json({ success: true, items })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}
