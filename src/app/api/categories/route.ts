// src/app/api/categories/route.ts
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || searchParams.get('search') || ''
    const lang = searchParams.get('lang') || 'th'

    // ข้อมูล categories จากฐานข้อมูล
    const categories = [
      { id: 1, name_th: 'ของหาย / ของถูกขโมย / ลืมของ', name_en: 'Lost/Stolen Items/Forgotten Items' },
      { id: 2, name_th: 'อุบัติเหตุ / เหตุบนท้องถนน', name_en: 'Accidents/Road Incidents' },
      { id: 3, name_th: 'ความเสียหาย / ทำลายทรัพย์สิน', name_en: 'Damage/Property Destruction' },
      { id: 4, name_th: 'บุคคลน่าสงสัย / การกระทำผิด', name_en: 'Suspicious Person/Misconduct' },
      { id: 5, name_th: 'เด็กหาย / คนหาย / คนพลัดหลง', name_en: 'Missing Child/Person/Missing Person' },
      { id: 6, name_th: 'ตรวจสอบพฤติกรรมบุคคล / ความเคลื่อนไหว', name_en: 'Monitor Person Behavior/Movement' },
      { id: 7, name_th: 'ตรวจสอบเหตุการณ์ย้อนหลัง', name_en: 'Review Past Events' },
      { id: 8, name_th: 'ติดตามรถ / ยานพาหนะ', name_en: 'Track Vehicle/Vehicle' },
      { id: 9, name_th: 'ส่งของผิด / พัสดุหาย', name_en: 'Wrong Delivery/Missing Package' },
      { id: 10, name_th: 'การฝ่าฝืนกฎในพื้นที่', name_en: 'Area Rule Violation' },
      { id: 11, name_th: 'การซ่อมบำรุง / ก่อสร้างผิดเวลา', name_en: 'Maintenance/Construction at Wrong Time' },
      { id: 12, name_th: 'รบกวนความสงบ / ปัญหาเพื่อนบ้าน / ทะเลาะวิวาท', name_en: 'Disturbing Peace/Neighbor Problems/Quarrels' },
      { id: 13, name_th: 'เหตุการณ์ในพื้นที่ส่วนรวม', name_en: 'Events in Common Areas' },
      { id: 15, name_th: 'ประสงค์ร้าย / ทำร้ายร่างกาย', name_en: 'Malicious Intent/Physical Assault' }
    ]

    // กรองข้อมูลตามคำค้นหา
    let filteredCategories = categories
    if (q.trim()) {
      const searchLower = q.toLowerCase()
      filteredCategories = categories.filter(category =>
        category.name_th.toLowerCase().includes(searchLower) ||
        category.name_en.toLowerCase().includes(searchLower)
      )
    }

    const items = filteredCategories.map((category) => ({
      id: category.id,
      name: lang === 'en' ? category.name_en : category.name_th,
      name_th: category.name_th,
      name_en: category.name_en,
    }))

    return Response.json({ success: true, data: items, items })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}