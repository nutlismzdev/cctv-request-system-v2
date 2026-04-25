// src/lib/thai-geo.ts
// ยูทิลโหลด + แคชข้อมูลเขตการปกครองไทยจากแหล่งสาธารณะ
// แคชไว้ในหน่วยความจำ (TTL 24 ชั่วโมง) เพื่อลดการยิงเน็ตซ้ำ

export type Province = {
    id: number
    name_th: string
    name_en: string
    geography_id?: number
  }
  
  export type Amphure = {
    id: number
    province_id: number
    name_th: string
    name_en: string
  }
  
  export type Tambon = {
    id: number
    amphure_id: number
    name_th: string
    name_en: string
    zip_code: string
  }

  // Raw API response type for subdistricts (different field name)
  type RawTambon = {
    id: number
    district_id: number
    name_th: string
    name_en: string
    zip_code: string
    lat: number | null
    long: number | null
    created_at: string
    updated_at: string
    deleted_at: string | null
  }
  
  // แหล่งข้อมูลสาธารณะ (JSON)
  const URL_PROVINCES =
    'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json'
  const URL_AMPHURES =
    'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json'
  const URL_TAMBONS =
    'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/sub_district.json'
  
  // -- in-memory cache --
  type CacheEntry<T> = { data: T; ts: number }
  const TTL = 24 * 60 * 60 * 1000 // 24h
  const cache = new Map<string, CacheEntry<unknown>>()
  
  async function fetchJSON<T>(key: string, url: string): Promise<T> {
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && now - hit.ts < TTL) return hit.data as T
  
    const res = await fetch(url, { next: { revalidate: 60 * 60 } }) // เผื่อให้ Next ช่วย cache อีกชั้น
    if (!res.ok) throw new Error(`Fetch ${url} failed: HTTP ${res.status}`)
    const data = (await res.json()) as T
    cache.set(key, { data, ts: now })
    return data
  }
  
  export async function getProvinces(): Promise<Province[]> {
    return fetchJSON<Province[]>('provinces', URL_PROVINCES)
  }
  export async function getAmphures(): Promise<Amphure[]> {
    return fetchJSON<Amphure[]>('amphures', URL_AMPHURES)
  }
  export async function getTambons(): Promise<Tambon[]> {
    const data = await fetchJSON<RawTambon[]>('tambons', URL_TAMBONS)
    // Transform district_id to amphure_id to match expected type
    return data.map(item => ({
      id: item.id,
      amphure_id: item.district_id,
      name_th: item.name_th,
      name_en: item.name_en,
      zip_code: item.zip_code,
    }))
  }
  
  // ยูทิลค้นหาแบบง่าย (ตัดช่องว่าง/เคส และใช้ localeCompare ให้เรียงไทยสวย ๆ)
  function norm(s: string) {
    return s.toLowerCase().trim().replace(/\s+/g, '')
  }
  
  export function filterByNameTH<T extends { name_th: string }>(
    items: T[],
    q?: string,
    limit = 20
  ) {
    if (!q) {
      return items.slice(0, limit).sort((a, b) => a.name_th.localeCompare(b.name_th, 'th-TH'))
    }
    const n = norm(q)
    return items
      .filter((x) => norm(x.name_th).includes(n))
      .sort((a, b) => a.name_th.localeCompare(b.name_th, 'th-TH'))
      .slice(0, limit)
  }
  