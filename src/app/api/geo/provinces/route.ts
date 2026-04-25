// src/app/api/geo/provinces/route.ts
export const runtime = 'nodejs'

import { getProvinces, filterByNameTH } from '@/lib/thai-geo'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || searchParams.get('search') || undefined
    const limit = Number(searchParams.get('limit') || '20')
    const lang = searchParams.get('lang') || 'th'

    const provinces = await getProvinces()
    const items = filterByNameTH(provinces, q, limit).map((p) => ({
      id: p.id,
      name: lang === 'en' ? p.name_en : p.name_th,
      name_th: p.name_th,
      name_en: p.name_en,
    }))

    return Response.json({ success: true, items })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}
