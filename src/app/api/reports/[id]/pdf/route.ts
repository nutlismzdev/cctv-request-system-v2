// src/app/api/reports/[id]/pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { PDFFont, PDFPage, PDFImage } from 'pdf-lib'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { RowDataPacket } from 'mysql2/promise'
import fs from 'fs/promises'
import path from 'path'

// ============================= Config =============================
const DEFAULT_FONT_SIZE = 16 // มาตรฐานราชการไทย
const TEXT_COLOR_BLUE = rgb(0.05, 0.25, 0.90) // น้ำเงินชัด อ่านง่าย

// ------------ Import shared database connection ------------
import { getPool } from '@/lib/db'

// ============================== Utils =============================
/** mm → pt (72pt = 1in, 25.4mm = 1in) */
const mm = (v: number) => (v * 72) / 25.4

/** แปลงค่าทั่วไปให้เป็น string ปลอดภัยสำหรับ drawText */
function asText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${d}/${m}/${y}`
  }
  return String(v)
}

/* ---------- Thai month names ---------- */
const THAI_MONTHS_FULL = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
] as const

/** yyyy-mm-dd | Date | string → "D เดือนไทย YYYY+543" (พ.ศ.) */
function toThaiDateStringThaiFull(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      const yBE = parseInt(m[1], 10) + 543
      const moIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))
      const d = String(parseInt(m[3], 10))
      return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
    }
    const dObj = new Date(v)
    if (!isNaN(dObj.getTime())) {
      const yBE = dObj.getFullYear() + 543
      const moIdx = dObj.getMonth()
      const d = String(dObj.getDate())
      return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
    }
    return v
  }
  if (v instanceof Date) {
    const yBE = v.getFullYear() + 543
    const moIdx = v.getMonth()
    const d = String(v.getDate())
    return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
  }
  return asText(v)
}

/** HH:mm:ss | Date | string → HH:mm */
function toThaiTimeString(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') {
    const hhmm = v.match(/T?(\d{2}):(\d{2})/)
    return hhmm ? `${hhmm[1]}:${hhmm[2]}` : v
  }
  if (v instanceof Date) {
    const h = String(v.getHours()).padStart(2, '0')
    const m = String(v.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  return asText(v)
}

/** ครอบวงเล็บ ถ้ายังไม่มี */
function withParens(input: string): string {
  const s = (input ?? '').trim()
  return /^\(.*\)$/.test(s) ? s : `(${s})`
}

/** ฟังก์ชันสำหรับข้อความที่อยู่ตามภาษา */
function getLocalizedAddressParts(isEnglish: boolean, isBkk: boolean): {
  houseNumber: string
  villageNumber: string
  subDistrict: string
  district: string
  province: string
} {
  if (isEnglish) {
    return {
      houseNumber: 'House No.',
      villageNumber: 'Village No.',
      subDistrict: 'Sub-district',
      district: 'District',
      province: 'Province'
    }
  } else {
    return {
      houseNumber: 'บ้านเลขที่',
      villageNumber: 'หมู่ที่',
      subDistrict: isBkk ? 'แขวง' : 'ตำบล',
      district: isBkk ? 'เขต' : 'อำเภอ',
      province: 'จังหวัด'
    }
  }
}

/** ฟังก์ชันสำหรับข้อความเอกสารหลักฐานตามภาษา */
function getLocalizedDocumentText(isEnglish: boolean): {
  idCardCopy: string
  policeReportCopy: string
  otherPrefix: string
} {
  if (isEnglish) {
    return {
      idCardCopy: '- Copy of ID Card/Government Official ID Card',
      policeReportCopy: '- Copy of Police Report',
      otherPrefix: '- Other: '
    }
  } else {
    return {
      idCardCopy: '- สำเนาบัตรประจำตัวประชาชน/บัตรประจำตัวเจ้าหน้าที่ของรัฐ',
      policeReportCopy: '- สำเนาบันทึกการแจ้งความ',
      otherPrefix: '- อื่นๆ: '
    }
  }
}

/** ฟังก์ชันสำหรับแปลง prefix เป็นภาษาที่เลือก */
function getLocalizedPrefix(prefix: string, isEnglish: boolean): string {
  const prefixMap: Record<string, { th: string; en: string }> = {
    'นาย': { th: 'นาย', en: 'Mr.' },
    'นาง': { th: 'นาง', en: 'Mrs.' },
    'นางสาว': { th: 'นางสาว', en: 'Ms.' }
  }

  const mapping = prefixMap[prefix]
  if (mapping) {
    return isEnglish ? mapping.en : mapping.th
  }

  // ถ้าไม่พบใน mapping ให้คืนค่าเดิม
  return prefix
}

/** ตัดคำนำหน้าชื่อไทยที่พบบ่อยออกจากชื่อเต็ม */
function stripThaiPrefix(name: string): string {
  const s = (name || '').trim()
  if (!s) return ''
  const common = [
    'นาย','นาง','นางสาว','ด.ช.','ด.ญ.','เด็กชาย','เด็กหญิง','คุณ','ว่าที่',
    'พ.ต.อ.','พ.ต.ท.','พ.ต.ต.','ร.ต.อ.','ร.ต.ท.','ส.ต.ต.','พล.ต.อ.','พล.ต.ต.',
  ]
  for (const p of common) {
    if (s.startsWith(p + ' ')) return s.slice((p + ' ').length).trim()
    if (s === p) return ''
  }
  return s
}

/** มีคำนำหน้าหรือยัง */
function hasThaiPrefix(name: string): boolean {
  const s = (name || '').trim()
  if (!s) return false
  return stripThaiPrefix(s) !== s
}

/** ทำชื่อไฟล์ให้ปลอดภัย (คงอักษรไทยได้) และใช้ _ แทนเว้นวรรค/เครื่องหมายต้องห้าม */
function sanitizeFilenameKeepUnicode(name: string): string {
  return (name || '')
    .replace(/[\\\/:*?"<>|]/g, '')   // windows-forbidden
    .replace(/\s+/g, '_')            // เว้นวรรค -> _
    .replace(/\+/g, '_')             // บังคับใช้ _
    .replace(/_+/g, '_')             // _ ซ้ำ ๆ -> เดียว
    .replace(/^_+|_+$/g, '')         // ตัด _ ต้น/ท้าย
}

/** fallback ASCII สำหรับ header filename= (แทนอักษรนอก ASCII ด้วย _) */
function toAsciiFallback(name: string): string {
  return sanitizeFilenameKeepUnicode(name).replace(/[^\x20-\x7E]/g, '_')
}

/** RFC 5987 encoder สำหรับ filename* (รองรับ UTF-8) */
function rfc5987Encode(str: string): string {
  // encodeURIComponent ก็เพียงพอ แล้วแต่งเพิ่มบางตัว
  return encodeURIComponent(str)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/** วันที่-เวลาไทยสั้น */
// function nowThaiDateTime(): string {
//   const d = new Date()
//   return `${toThaiDateStringThaiFull(d)} ${toThaiTimeString(d)}`
// }

// =============================== DB ==============================
type ReportRecord = {
  prefix?: string | null
  full_name?: string | null
  age?: number | string | null
  id_or_passport_number?: string | null
  phone_number?: string | null
  house_number?: string | null
  village_number?: string | null
  alley?: string | null
  road?: string | null
  sub_district?: string | null
  district?: string | null
  province?: string | null
  postal_code?: string | null
  language?: string | null
  request_type?: string | null
  incident_date?: string | null
  incident_time?: string | null
  incident_location?: string | null
  involvement_role?: string | null
  involvement_explain?: string | null
  supporting_documents?: string | null
  submitted_at?: string | null
  officer_name?: string | null
  officer_prefix?: string | null
  officer_position?: string | null
  officer_comments?: string | null
  officer_decision?: string | null
  internal_notes?: string | null
}

type AttachmentRecord = {
  id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  category: string
  uploaded_at: string
  url: string
}
async function getReportById(reportId: string): Promise<ReportRecord | null> {
  const sql = `
    SELECT
      r.*,
      r.involvement_role,
      r.involvement_explain,
      r.supporting_documents,
      c.category_name,
      o.prefix AS officer_prefix,
      o.full_name AS officer_name,
      o.position  AS officer_position
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.category_id
    LEFT JOIN officers   o ON r.assigned_officer_id = o.officer_id
    WHERE r.report_id = ?
    LIMIT 1
  `
  const [rows] = await getPool().execute<RowDataPacket[]>(sql, [reportId])
  const row = (rows as RowDataPacket[])[0] as unknown as ReportRecord | undefined
  return row ?? null
}

async function getAttachmentsByReportId(reportId: string): Promise<AttachmentRecord[]> {
  const sql = `
    SELECT
      doc_id as id,
      file_name,
      file_path,
      file_size,
      mime_type as file_type,
      document_type,
      uploaded_at
    FROM request_documents
    WHERE report_id = ? AND is_deleted = false
    ORDER BY uploaded_at ASC
  `
  const [rows] = await getPool().execute<RowDataPacket[]>(sql, [reportId])

  // Map document_type to category for compatibility
  const categoryMap: Record<string, string> = {
    'id_card_copy': 'idcopy',
    'supporting_document': 'operation',
    'passport_copy': 'passport',
    'police_report': 'police',
    'incident_report': 'incident',
    'power_of_attorney': 'power_of_attorney',
    'legal_document': 'legal'
  }

  return (rows as RowDataPacket[]).map(row => {
    // จัดการข้อมูลเก่า: ถ้า file_path ขึ้นต้นด้วย 'attachments/' ให้ตัดออก
    const cleanFilePath = row.file_path.startsWith('attachments/')
      ? row.file_path.substring('attachments/'.length)
      : row.file_path

    return {
      id: row.id,
      file_name: row.file_name,
      file_path: cleanFilePath, // ใช้ file_path ที่ clean แล้ว
      file_size: row.file_size,
      file_type: row.file_type,
      category: categoryMap[row.document_type] || 'operation',
      uploaded_at: row.uploaded_at,
      url: `/api/files/attachments/${cleanFilePath}`
    }
  }) as AttachmentRecord[]
}

// ============================== Fonts =============================
async function loadThaiFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  pdfDoc.registerFontkit(fontkit)
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf'),
    path.join(process.cwd(), 'public', 'font',  'THSarabunNew.ttf'),
    path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'),
    path.join(process.cwd(), 'public', 'font',  'Sarabun-Regular.ttf'),
  ]
  for (const p of candidates) {
    try {
      const bytes = await fs.readFile(p)
      return await pdfDoc.embedFont(bytes, { subset: true })
    } catch {}
  }
  // Fallback (อาจแสดงไทยไม่ครบ)
  return await pdfDoc.embedFont(StandardFonts.Helvetica)
}

// ========================= Debug Grid (mm) ========================
function drawDebugGridMM(page: PDFPage, font: PDFFont) {
  const { width: W, height: H } = page.getSize()
  const minorColor = rgb(0.88, 0.90, 0.95)
  const majorColor = rgb(0.65, 0.72, 0.88)
  const axisColor  = rgb(0.25, 0.33, 0.67)
  const labelColor = rgb(0.18, 0.22, 0.35)

  // แกนบน/ซ้าย
  page.drawLine({ start: { x: 0, y: H }, end: { x: W, y: H }, thickness: 1.5, color: axisColor })
  page.drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: H }, thickness: 1.5, color: axisColor })

  // แนวตั้ง
  for (let xmm = 0; ; xmm += 10) {
    const x = mm(xmm)
    if (x > W) break
    const isMajor = xmm % 50 === 0
    page.drawLine({
      start: { x, y: 0 }, end: { x, y: H },
      thickness: isMajor ? 1 : 0.5,
      color: isMajor ? majorColor : minorColor,
    })
    if (isMajor && xmm > 0) page.drawText(`${xmm} mm`, { x: x + 2, y: H - 12, size: 8, font, color: labelColor })
  }

  // แนวนอน
  for (let ymm = 0; ; ymm += 10) {
    const y = H - mm(ymm)
    if (y < 0) break
    const isMajor = ymm % 50 === 0
    page.drawLine({
      start: { x: 0, y }, end: { x: W, y },
      thickness: isMajor ? 1 : 0.5,
      color: isMajor ? majorColor : minorColor,
    })
    if (isMajor && ymm > 0) page.drawText(`${ymm} mm`, { x: 3, y, size: 8, font, color: labelColor })
  }
}

// ============================ Drawing ============================
function drawText(
  page: PDFPage,
  font: PDFFont,
  input: unknown,
  pos: { x: number; y: number },
  opts?: { fontSize?: number; color?: ReturnType<typeof rgb>; maxWidth?: number },
) {
  const fontSize = opts?.fontSize ?? DEFAULT_FONT_SIZE
  const color = opts?.color ?? TEXT_COLOR_BLUE
  const maxWidth = opts?.maxWidth ?? 400
  const text = asText(input)

  let displayText = text
  try {
    const width = font.widthOfTextAtSize(text, fontSize)
    if (width > maxWidth) {
      const ratio = maxWidth / width
      const cut = Math.max(0, Math.floor(text.length * ratio) - 1)
      displayText = text.slice(0, cut) + '…'
    }
  } catch {
    const approxCharW = fontSize * 0.6
    const maxChars = Math.floor(maxWidth / approxCharW)
    if (text.length > maxChars) displayText = text.slice(0, maxChars - 1) + '…'
  }

  page.drawText(displayText, { x: pos.x, y: pos.y, size: fontSize, font, color })
}

/** mm (top-left) → พิกัด PDF (baseline) */
function placeTL(page: PDFPage, xmm: number, ymm: number, wmm = 0) {
  const { height } = page.getSize()
  const x = mm(xmm)
  const y = height - mm(ymm)
  const w = mm(wmm)
  return { x, y, w }
}

/* ====================== Field Positions (mm, TL) ====================== */
const FIELD_MM = {
  // ส่วนหัว
  date:               { x:140, y: 52,   w: 32 },

  // ข้อมูลผู้ยื่น (ตัวอย่าง: ใช้อยู่ในแบบฟอร์ม)
  fullNameLine:       { x:  65, y:  68,  w: 100 },
  age:                { x: 170, y:  68,  w: 20 },
  idNumber:           { x: 100, y:  74,  w: 60 },
  phone:              { x: 140, y:  87,  w: 40 },
  address:            { x:  37, y:  80.5,w: 160 },
  districtProvinceLine:{ x: 30, y: 87, w: 160 },
  requestType:        { x:  57, y:  93.5,w: 80 },
  incidentDate:       { x: 138, y:  93.5,w: 38 },
  incidentTime:       { x:  53, y: 100,  w: 28 },
  incidentLocation:   { x:  37, y: 106.5,w: 160 },

  // ลายเซ็นผู้ยื่น (อิสระ)
  signByLine1:        { x: 124, y: 139.5,  w: 90 },   // ชื่อ-สกุล (ไม่มีคำนำหน้า)
  signByLine2:        { x: 120, y: 145,  w: 100 },  // (คำนำหน้า+ชื่อ-สกุล)

  // เจ้าหน้าที่ (อิสระ)
  officerLine1:       { x:  56, y: 194,  w: 110 },  // ชื่อ-สกุล (ไม่มีคำนำหน้า)
  officerLine2:       { x:  52, y: 199,  w: 110 },  // (คำนำหน้า+ชื่อ-สกุล)
  officerLine3:       { x:  45, y: 204.5,w: 110 },  // ตำแหน่ง
  officerLine3Special:{ x:  56, y: 204.5,w: 140 },  // ตำแหน่งยาว

  officer_decision:   { x:  48, y: 177,  w: 80 },
  officer_comments:   { x:  37, y: 204,  w: 160 },
  internal_notes:     { x:  61, y: 183,  w: 160 },
} as const

/* ====== Address helpers (PDF only; minimal/local changes) ====== */
function isBangkokProvince(prov?: unknown): boolean {
  const p = asText(prov)
  return /กรุงเทพ|bangkok/i.test(p)
}
function normAlleyForPdf(alley?: unknown, isEnglish: boolean = false): string {
  const s = asText(alley).trim()
  if (!s || s === '-') return ''

  if (isEnglish) {
    // English: ถ้ามี "ซอย" หรือ "ตรอก" นำหน้าแล้ว ให้แทนที่
    if (/^(ซอย|ตรอก)\s*/i.test(s)) {
      return s.replace(/^(ซอย|ตรอก)\s*/i, (match) => {
        return match.toLowerCase().includes('ซอย') ? 'Alley ' : 'Lane '
      })
    }
    return `Alley ${s}`
  } else {
    // Thai: ตรรกะเดิม
    if (/^(ซอย|ตรอก)\s*/i.test(s)) return s
    return `ซอย ${s}`
  }
}

function normRoadForPdf(road?: unknown, isEnglish: boolean = false): string {
  const s = asText(road).trim()
  if (!s || s === '-') return ''

  if (isEnglish) {
    // English: ถ้ามี "ถนน" นำหน้าแล้ว ให้แทนที่
    if (/^ถนน\s*/i.test(s)) {
      return s.replace(/^ถนน\s*/i, 'Road ')
    }
    return `Road ${s}`
  } else {
    // Thai: ตรรกะเดิม
    if (/^ถนน\s*/i.test(s)) return s
    return `ถนน ${s}`
  }
}

/** วาดทุกฟิลด์ด้วยพิกัด mm (top-left) */
function drawTextFields(page: PDFPage, font: PDFFont, report: ReportRecord) {
  const isEnglish = report.language === 'en'
  const T = (key: keyof typeof FIELD_MM, value: unknown) => {
    const f = FIELD_MM[key]
    const { x, y, w } = placeTL(page, f.x, f.y, f.w)
    drawText(page, font, value, { x, y }, { maxWidth: w })
  }

  // ----- ผู้ยื่น: ชื่อ -----
  const originalPrefix = asText(report?.prefix).trim()
  const localizedPrefix = getLocalizedPrefix(originalPrefix, isEnglish)
  const fullNameNormalized = asText(report?.full_name).trim().replace(/\s+/g, ' ')
  const nameWithPrefix = localizedPrefix && fullNameNormalized
    ? `${localizedPrefix}${fullNameNormalized}`
    : (fullNameNormalized || localizedPrefix)

  // ===== ที่อยู่แบบยืดหยุ่น (รวมหรือแยกตามความเหมาะสม) =====
  const isBkk = isBangkokProvince(report?.province)
  const addrParts = getLocalizedAddressParts(isEnglish, isBkk)

  const house = asText(report?.house_number).trim()
  const village = asText(report?.village_number).trim()
  const alley = normAlleyForPdf(report?.alley, isEnglish)
  const road  = normRoadForPdf(report?.road, isEnglish)
  const sub   = asText(report?.sub_district).trim()
  const dist  = asText(report?.district).trim()
  const prov  = asText(report?.province).trim()
  const zip   = asText(report?.postal_code).trim()

  // สร้างส่วนประกอบที่อยู่ทั้งหมด
  const addrMainParts: string[] = []
  if (house)   addrMainParts.push(`${addrParts.houseNumber} ${house}`)
  if (village) addrMainParts.push(`${addrParts.villageNumber} ${village}`)
  if (alley)   addrMainParts.push(alley)
  if (road)    addrMainParts.push(road)
  if (sub)     addrMainParts.push(`${addrParts.subDistrict} ${sub}`)

  const dpParts: string[] = []
  if (dist) dpParts.push(`${addrParts.district} ${dist}`)
  if (prov) dpParts.push(`${addrParts.province} ${prov}`)
  if (zip)  dpParts.push(zip)

  const addressMainLine = addrMainParts.join(' ')
  const districtProvinceText = dpParts.join(' ')

  // ตรวจสอบว่าสามารถรวมที่อยู่ทั้งหมดในบรรทัดเดียวได้หรือไม่
  let finalAddressLine1 = addressMainLine
  let finalAddressLine2 = districtProvinceText

  // ถ้ามีข้อมูลในทั้งสองส่วน และความยาวรวมไม่เกินขีดจำกัดที่เหมาะสม
  // ให้รวมเข้าด้วยกันเพื่อไม่ให้เปลืองพื้นที่
  if (addressMainLine && districtProvinceText) {
    const combinedAddress = `${addressMainLine} ${districtProvinceText}`

    // คำนวณความยาวโดยประมาณ (อักษรไทยกว้างกว่าอักษร ASCII)
    const thaiChars = (combinedAddress.match(/[\u0E00-\u0E7F]/g) || []).length
    const asciiChars = combinedAddress.length - thaiChars
    const estimatedWidth = asciiChars + thaiChars * 1.3 // อักษรไทยกว้างกว่าประมาณ 30%

    // ถ้ากว้างรวมไม่เกิน 95 หน่วย หรือบรรทัดแรกสั้นมาก (น้อยกว่า 50 ตัวอักษร)
    // ให้รวมเป็นบรรทัดเดียวเพื่อไม่ให้เปลืองพื้นที่
    if (estimatedWidth <= 95 || addressMainLine.length < 50) {
      finalAddressLine1 = combinedAddress
      finalAddressLine2 = '' // ล้างบรรทัดที่สอง
    }
  }

  // ===== วาดค่าหลัก =====
  T('date',             toThaiDateStringThaiFull(report?.submitted_at))
  T('fullNameLine',     nameWithPrefix)
  T('age',              report?.age)
  T('idNumber',         report?.id_or_passport_number)
  T('phone',            report?.phone_number)

  // ที่อยู่: วาดแบบยืดหยุ่น (รวมหรือแยกบรรทัดตามความเหมาะสม)
  T('address',              finalAddressLine1)
  if (finalAddressLine2) T('districtProvinceLine', finalAddressLine2)

  T('requestType',      report?.request_type)
  T('incidentDate',     toThaiDateStringThaiFull(report?.incident_date))
  T('incidentTime',     toThaiTimeString(report?.incident_time))
  T('incidentLocation', report?.incident_location)
  // แสดงเอกสารหลักฐานประกอบ แยกเป็นหลายบรรทัด
  if (report?.supporting_documents) {
    try {
      const docs = JSON.parse(report.supporting_documents)
      const docTexts = getLocalizedDocumentText(isEnglish)
      let yOffset = 123 // เริ่มที่ y: 123

      if (docs.id_card_copy) {
        const { x, y, w } = placeTL(page, 60, yOffset, 160)
        drawText(page, font, docTexts.idCardCopy, { x, y }, { maxWidth: w })
        yOffset += 6 // เพิ่มระยะห่าง 5mm
      }

      if (docs.police_report_copy) {
        const { x, y, w } = placeTL(page, 60, yOffset, 160)
        drawText(page, font, docTexts.policeReportCopy, { x, y }, { maxWidth: w })
        yOffset += 6 // เพิ่มระยะห่าง 5mm
      }

      if (docs.other) {
        const otherText = `${docTexts.otherPrefix}${docs.other_details || (isEnglish ? 'Not specified' : 'ไม่ได้ระบุ')}`
        const { x, y, w } = placeTL(page, 60, yOffset, 160)
        drawText(page, font, otherText, { x, y }, { maxWidth: w })
      }
    } catch {
      // ถ้าข้อมูลไม่ถูกต้อง แสดงข้อความ error
      const errorText = isEnglish ? 'Invalid document data' : 'ข้อมูลเอกสารไม่ถูกต้อง'
      const { x, y, w } = placeTL(page, 60, 123, 160)
      drawText(page, font, errorText, { x, y }, { maxWidth: w })
    }
  }

  // ลงชื่อผู้ยื่น
  if (fullNameNormalized) T('signByLine1', fullNameNormalized)
  if (nameWithPrefix)     T('signByLine2', withParens(nameWithPrefix))

  // เจ้าหน้าที่ (คงเดิม)
  if (report?.officer_name) {
    const officerFull = asText(report.officer_name).trim().replace(/\s+/g, ' ')
    const officerNoPrefix = stripThaiPrefix(officerFull) || officerFull
    if (officerNoPrefix) T('officerLine1', officerNoPrefix)

    const officerPrefix = asText(report?.officer_prefix).trim()
    const officerWithPrefix = hasThaiPrefix(officerFull)
      ? officerFull
      : (officerPrefix ? `${officerPrefix}${officerFull}` : officerFull)
    T('officerLine2', withParens(officerWithPrefix))

    if (report?.officer_position) {
      const position = asText(report.officer_position)
      if (position === 'ผู้ช่วยนายช่างไฟฟ้า') {
        T('officerLine3Special', position)
      } else {
        T('officerLine3', position)
      }
    }
  }

  if (report?.officer_decision) T('officer_decision', `${report.officer_decision}`)
  if (report?.officer_comments) T('officer_comments', `ความคิดเห็น: ${report.officer_comments}`)
  // แสดงรายละเอียดการปฏิบัติเฉพาะเมื่อความคิดเห็นเจ้าหน้าที่เป็น "ไม่อนุญาต"
  if (report?.officer_decision === 'ไม่อนุญาต' && report?.internal_notes) {
    T('internal_notes', `${report.internal_notes}`)
  }
}

/* ==================== Official watermark helpers ==================== */
/**
 * ลายน้ำมาตรฐานงานราชการไทย (จาง สีเทา หมุนเฉียง ทำซ้ำเต็มหน้า)
 * ข้อความ: "เอกสารประกอบคำร้องขอดูภาพกล้อง CCTV • เทศบาลนครหัวหิน"
 */
function drawOfficialWatermarks(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize()
  const angle = -30
  const text = 'เอกสารประกอบคำร้องขอดูภาพกล้อง CCTV • เทศบาลนครหัวหิน'
  const baseSize = Math.min(width, height) * 0.06 // ขนาดตัวอักษรพื้นฐาน (~6% ของด้านสั้น)
  const color = rgb(0.6, 0.6, 0.6) // เทากลาง
  const opacity = 0.15 // จางตามแนวทางเอกสารราชการ

  // คำนวณระยะก้าวตามความกว้างข้อความ
  let textWidth = 0
  try { textWidth = font.widthOfTextAtSize(text, baseSize) } catch { textWidth = baseSize * text.length * 0.6 }

  const stepX = Math.max(textWidth * 0.7, width * 0.6)
  const stepY = baseSize * 4.5

  // วาดลายน้ำแบบกระดานหมากรุกครอบคลุมทั้งหน้า
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      page.drawText(text, {
        x,
        y,
        size: baseSize,
        font,
        color,
        opacity,
        rotate: degrees(angle),
      })
    }
  }
}

/**
 * ลายน้ำเสริมสำหรับเอกสารที่เป็น "สำเนาบัตร/สำเนาเอกสารสำคัญ"
 * แสดงบทบาทความเกี่ยวข้องและคำอธิบายอย่างจาง ๆ กึ่งกลางหน้า
 */
function drawRoleWatermarks(page: PDFPage, font: PDFFont, role?: string | null, explain?: string | null) {
  if (!role) return
  const { width, height } = page.getSize()
  const angle = -30
  const size = Math.min(width, height) * 0.08
  const color = rgb(0.35, 0.35, 0.35)
  const opacity = 0.20

  const lines = [role.trim()].concat(explain && explain.trim() ? [explain.trim()] : [])
  const centerX = width * 0.5
  const centerY = height * 0.5
  const lineGap = size * 1.1

  lines.forEach((line, idx) => {
    page.drawText(line, {
      x: centerX,
      y: centerY + (idx === 0 ? lineGap * 0.5 : -lineGap * 0.6),
      size,
      font,
      color,
      opacity,
      rotate: degrees(angle),
    })
  })
}

/** วาดข้อมูลเอกสารแนบในหน้าใหม่ พร้อม embed ไฟล์จริง */
async function drawAttachmentsPage(pdfDoc: PDFDocument, font: PDFFont, attachments: AttachmentRecord[], report: ReportRecord) {
  // แยกเอกสารตามหมวดหมู่
  const idCopyDocs = attachments.filter(att => att.category === 'idcopy')
  const operationDocs = attachments.filter(att => att.category === 'operation')

  // ฟังก์ชันสำหรับ embed ไฟล์ PDF
  const embedPDFFile = async (filePath: string, fileName: string, isIdCopy: boolean) => {
    try {
      // filePath จาก database จะเป็น 'filename.pdf' (หลังการแก้ไข)
      // ไฟล์อยู่ที่ public/uploads/attachments/filename.pdf
      const fullPath = path.join(process.cwd(), 'public', 'uploads', 'attachments', filePath)
      console.log(`📄 Attempting to embed PDF: ${fileName}`)
      console.log(`📂 Full path: ${fullPath}`)

      // ตรวจสอบว่าไฟล์มีอยู่จริง
      try {
        await fs.access(fullPath)
        console.log(`✅ File exists: ${fullPath}`)
      } catch {
        console.error(`❌ File not found: ${fullPath}`)
        return
      }

      const pdfBytes = await fs.readFile(fullPath)
      const embeddedPdf = await PDFDocument.load(pdfBytes)

      // Get all page indices
      const pageCount = embeddedPdf.getPageCount()
      console.log(`📊 PDF has ${pageCount} pages`)

      const pageIndices = Array.from({ length: pageCount }, (_, i) => i)

      // Copy ทุกหน้า
      const embeddedPages = await pdfDoc.copyPages(embeddedPdf, pageIndices)

      embeddedPages.forEach((page, index) => {
        pdfDoc.addPage(page)
        // เพิ่มหัวข้อหน้า
        const addedPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
        addedPage.drawText(`${fileName} - หน้า ${index + 1}`, {
          x: mm(10),
          y: addedPage.getSize().height - mm(10),
          size: 10,
          font,
          color: rgb(0.5, 0.5, 0.5)
        })

        // ลายน้ำมาตรฐานทางราชการ (จาง/ซ้ำทั้งหน้า)
        drawOfficialWatermarks(addedPage, font)

        // ลายน้ำบทบาท/ความเกี่ยวข้อง (เฉพาะเอกสารสำเนาบัตร/สำคัญ)
        if (isIdCopy && report?.involvement_role) {
          drawRoleWatermarks(
            addedPage,
            font,
            report.involvement_role || undefined,
            report.involvement_explain || undefined
          )
        }
      })

      console.log(`✅ Successfully embedded PDF: ${fileName} (${pageCount} pages)`)
    } catch (error) {
      console.error(`❌ Error embedding PDF ${fileName}:`, error)
      console.error(`   Path attempted: ${path.join(process.cwd(), 'public', 'uploads', 'attachments', filePath)}`)
    }
  }

  // ฟังก์ชันสำหรับ embed รูปภาพ
  const embedImageFile = async (filePath: string, fileName: string, mimeType: string, isIdCopy: boolean) => {
    try {
      // filePath จาก database จะเป็น 'filename.jpg' (หลังการแก้ไข)
      // ไฟล์อยู่ที่ public/uploads/attachments/filename.jpg
      const fullPath = path.join(process.cwd(), 'public', 'uploads', 'attachments', filePath)
      console.log(`🖼️  Attempting to embed image: ${fileName}`)
      console.log(`📂 Full path: ${fullPath}`)

      // ตรวจสอบว่าไฟล์มีอยู่จริง
      try {
        await fs.access(fullPath)
        console.log(`✅ File exists: ${fullPath}`)
      } catch {
        console.error(`❌ File not found: ${fullPath}`)
        return
      }

      const imageBytes = await fs.readFile(fullPath)

      const newPage = pdfDoc.addPage()
      const { width: pageWidth, height: pageHeight } = newPage.getSize()

      let embeddedImage: PDFImage
      if (mimeType === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(imageBytes)
      } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        embeddedImage = await pdfDoc.embedJpg(imageBytes)
      } else {
        // พยายาม detect จาก extension ถ้า mime type ไม่ชัดเจน
        const lowerName = fileName.toLowerCase()
        if (lowerName.endsWith('.png')) {
          embeddedImage = await pdfDoc.embedPng(imageBytes)
        } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          embeddedImage = await pdfDoc.embedJpg(imageBytes)
        } else {
          return // ไม่รองรับประเภทไฟล์นี้
        }
      }

      // ปรับขนาดรูปภาพให้พอดีกับหน้า (80% ของขนาดหน้า)
      const scaleFactor = Math.min(
        (pageWidth * 0.8) / embeddedImage.width,
        (pageHeight * 0.8) / embeddedImage.height
      )

      const imgWidth = embeddedImage.width * scaleFactor
      const imgHeight = embeddedImage.height * scaleFactor

      const x = (pageWidth - imgWidth) / 2
      const y = (pageHeight - imgHeight) / 2

      newPage.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight
      })

      // เพิ่มชื่อไฟล์
      newPage.drawText(fileName, {
        x: mm(10),
        y: pageHeight - mm(10),
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5)
      })

      // ลายน้ำมาตรฐานทางราชการ (จาง/ซ้ำทั้งหน้า)
      drawOfficialWatermarks(newPage, font)

      // ลายน้ำบทบาท/ความเกี่ยวข้อง (เฉพาะเอกสารสำเนาบัตร/สำคัญ)
      if (isIdCopy && report?.involvement_role) {
        drawRoleWatermarks(
          newPage,
          font,
          report.involvement_role || undefined,
          report.involvement_explain || undefined
        )
      }

      console.log(`✅ Successfully embedded image: ${fileName}`)
    } catch (error) {
      console.error(`❌ Error embedding image ${fileName}:`, error)
      console.error(`   Path attempted: ${path.join(process.cwd(), 'public', 'uploads', 'attachments', filePath)}`)
    }
  }

  // Embed ไฟล์ทั้งหมดโดยตรง (ไม่แสดงรายการ)
  const allDocs = [...idCopyDocs, ...operationDocs]

  for (const doc of allDocs) {
    // Embed ไฟล์จริง
    const isIdCopy = doc.category === 'idcopy'
    if (doc.file_type === 'application/pdf') {
      await embedPDFFile(doc.file_path, doc.file_name, isIdCopy)
    } else if (doc.file_type.startsWith('image/')) {
      await embedImageFile(doc.file_path, doc.file_name, doc.file_type, isIdCopy)
    }
  }

  return pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
}


// ============================== Route ============================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1'
    const mode = searchParams.get('mode') || 'draw' // 'grid' | 'draw'
    const resolvedParams = await params
    const reportId = resolvedParams.id

    const report = await getReportById(reportId)
    if (!report) {
      return new Response('ไม่พบรายงานที่ระบุ', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // ดึงข้อมูลเอกสารแนบ
    const attachments = await getAttachmentsByReportId(reportId)
    console.log(`📋 Found ${attachments.length} attachments for report ${reportId}:`)
    attachments.forEach((att, index) => {
      console.log(`   ${index + 1}. ${att.file_name} (${att.file_type}) - Path: ${att.file_path} - Category: ${att.category}`)
    })

    // ====== โหลดเทมเพลต + วาด ======
    const templatePath = path.join(process.cwd(), 'public', 'form', 'แบบคำร้องขอดูกล้อง.pdf')
    const templateBytes = await fs.readFile(templatePath)

    const pdfDoc = await PDFDocument.load(templateBytes)
    const font = await loadThaiFont(pdfDoc)
    const [firstPage] = pdfDoc.getPages()

    if (mode === 'grid') {
      drawDebugGridMM(firstPage, font)
    } else {
      if (debug) drawDebugGridMM(firstPage, font)
      drawTextFields(firstPage, font, report)
    }

    // สร้างหน้าเอกสารแนบถ้ามีเอกสารแนบ
    if (attachments.length > 0) {
      await drawAttachmentsPage(pdfDoc, font, attachments, report)
    }

    const pdfBytes = await pdfDoc.save()

    // Convert Uint8Array to Buffer for Node.js Response compatibility
    const pdfBuffer = Buffer.from(pdfBytes)

    // ====== ตั้งชื่อไฟล์: fullNameLine_วันที่แบบไทย.pdf ======
    const originalPrefix = asText(report?.prefix).trim()
    const localizedPrefix = getLocalizedPrefix(originalPrefix, report?.language === 'en')
    const fullNameNormalized = asText(report?.full_name).trim().replace(/\s+/g, ' ')
    const fullNameLine = (localizedPrefix && fullNameNormalized)
      ? `${localizedPrefix}${fullNameNormalized}`
      : (fullNameNormalized || localizedPrefix || (report?.language === 'en' ? 'Unknown Name' : 'ไม่ระบุชื่อ'))

    const dateName = toThaiDateStringThaiFull(report?.submitted_at) || 'ไม่ระบุวันที่'
    const baseNameRaw = `${fullNameLine}_${dateName}`             // ใช้ _ เป็นตัวคั่น
    const baseNameSafe = sanitizeFilenameKeepUnicode(baseNameRaw)     // คงอักษรไทยได้
    const asciiFallback = toAsciiFallback(baseNameSafe)

    const fileUtf8 = `${baseNameSafe}.pdf`
    const fileAscii = `${asciiFallback}.pdf`

    // ====== บังคับ "เปิดแสดงก่อน" และกำหนดชื่อไฟล์ (รองรับไทย) ======
    const contentDisposition =
      `inline; filename="${fileAscii}"; filename*=UTF-8''${rfc5987Encode(fileUtf8)}`

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition, // เปิดแสดงก่อน พร้อมชื่อไฟล์
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    console.error('Error generating PDF:', error)
    // ใช้ภาษาไทยเป็น default ใน catch block เพราะอาจเกิด error ก่อนที่จะรู้ language
    const errorMessage = 'เกิดข้อผิดพลาดในการสร้าง PDF'
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        error: (error instanceof Error && error.message) ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    )
  }
}
