// src/app/api/admin/reports/monthly-pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { RowDataPacket } from 'mysql2/promise'
import fs from 'fs/promises'
import path from 'path'
import { getPool } from '@/lib/db'

// ============================= Config =============================
const PAGE_W = 595.28 // A4 width in pt
const PAGE_H = 841.89 // A4 height in pt
const MARGIN_LEFT = mm(20)
const MARGIN_RIGHT = mm(20)
const MARGIN_TOP = mm(15)
const MARGIN_BOTTOM = mm(20)
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT

const FONT_SIZE = 16
const FONT_SIZE_HEADER = 20
const FONT_SIZE_SMALL = 14
const FONT_SIZE_TABLE = 13
const LINE_HEIGHT = FONT_SIZE * 1.4
const TABLE_LINE_HEIGHT = FONT_SIZE_TABLE * 1.5

const COLOR_BLACK = rgb(0, 0, 0)
const COLOR_GRAY_HEADER = rgb(0.92, 0.92, 0.92)
const COLOR_GRAY_TEXT = rgb(0.3, 0.3, 0.3)

// ============================= Utils =============================
function mm(v: number) { return (v * 72) / 25.4 }

const THAI_MONTHS_FULL = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
] as const

const THAI_MONTHS_SHORT = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'
] as const

/** Characters where it is OK to break a line (whitespace + light punctuation). */
const SOFT_BREAK_RE = /[\s,.;:/()\[\]\-—]/

/** Truncate text to fit within maxWidth */
function fitText(font: PDFFont, text: string, fontSize: number, maxWidth: number): string {
  try {
    const w = font.widthOfTextAtSize(text, fontSize)
    if (w <= maxWidth) return text
    const ratio = maxWidth / w
    const cut = Math.max(0, Math.floor(text.length * ratio) - 1)
    return text.slice(0, cut) + '…'
  } catch {
    const approxCharW = fontSize * 0.5
    const maxChars = Math.floor(maxWidth / approxCharW)
    if (text.length > maxChars) return text.slice(0, maxChars - 1) + '…'
    return text
  }
}

/**
 * Wrap text to fit within maxWidth.
 * Prefers whitespace/punctuation breaks (so English words stay intact);
 * falls back to character-level wrap for Thai text or unbreakable strings.
 */
function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number): string[] {
  const value = (text ?? '').toString()
  if (!value) return ['']
  const lines: string[] = []
  for (const para of value.split(/\r?\n/)) {
    if (!para) { lines.push(''); continue }
    const chars = Array.from(para)
    let buf = ''
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]
      const next = buf + ch
      if (textWidth(font, next, fontSize) > maxWidth && buf) {
        // Look back for a soft-break point within the current buffer.
        let breakAt = -1
        for (let j = buf.length - 1; j >= Math.max(0, buf.length - 40); j--) {
          if (SOFT_BREAK_RE.test(buf[j])) { breakAt = j; break }
        }
        if (breakAt > 0) {
          lines.push(buf.slice(0, breakAt + 1).replace(/\s+$/, ''))
          buf = buf.slice(breakAt + 1).replace(/^\s+/, '') + ch
        } else {
          lines.push(buf)
          buf = ch
        }
      } else {
        buf = next
      }
    }
    if (buf) lines.push(buf)
  }
  return lines.length ? lines : ['']
}

/** Measure text width safely */
function textWidth(font: PDFFont, text: string, fontSize: number): number {
  try {
    return font.widthOfTextAtSize(text, fontSize)
  } catch {
    return text.length * fontSize * 0.5
  }
}

// ============================= Font =============================
async function loadThaiFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  pdfDoc.registerFontkit(fontkit)
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf'),
    path.join(process.cwd(), 'public', 'font', 'THSarabunNew.ttf'),
    path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'),
  ]
  for (const p of candidates) {
    try {
      const bytes = await fs.readFile(p)
      return await pdfDoc.embedFont(bytes, { subset: true })
    } catch { /* try next */ }
  }
  const { StandardFonts } = await import('pdf-lib')
  return await pdfDoc.embedFont(StandardFonts.Helvetica)
}

// ============================= DB Types =============================
interface StatusRow extends RowDataPacket { status: string; count: number }
interface TypeRow extends RowDataPacket { request_type: string | null; count: number }
interface CategoryRow extends RowDataPacket { category_name: string | null; count: number }
interface LocationRow extends RowDataPacket { incident_location: string; count: number }
interface ProcessingTimeRow extends RowDataPacket { avg_days: number | null }
interface RejectedRow extends RowDataPacket {
  report_id: number
  full_name: string | null
  created_at: Date | string | null
  rejection_reason: string | null
}

// ============================= PDF Drawing Helpers =============================

/** Draw centered text */
function drawCentered(page: PDFPage, font: PDFFont, text: string, y: number, fontSize: number, color = COLOR_BLACK) {
  const w = textWidth(font, text, fontSize)
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size: fontSize, font, color })
}

/** Draw a horizontal line */
function drawHLine(page: PDFPage, y: number, x1 = MARGIN_LEFT, x2 = PAGE_W - MARGIN_RIGHT) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 1, color: COLOR_BLACK })
}

/** Draw table row with borders */
function drawTableRow(
  page: PDFPage, font: PDFFont,
  cols: { text: string; width: number; align?: 'left' | 'right' | 'center' }[],
  y: number, rowHeight: number,
  isHeader = false
) {
  let x = MARGIN_LEFT

  // Background for header
  if (isHeader) {
    page.drawRectangle({
      x: MARGIN_LEFT, y: y - rowHeight + 4,
      width: CONTENT_W, height: rowHeight,
      color: COLOR_GRAY_HEADER,
    })
  }

  // Draw cell borders and text
  for (const col of cols) {
    // Cell border
    page.drawRectangle({
      x, y: y - rowHeight + 4,
      width: col.width, height: rowHeight,
      borderColor: COLOR_BLACK, borderWidth: 0.5,
      color: isHeader ? COLOR_GRAY_HEADER : rgb(1, 1, 1),
      opacity: 0,
      borderOpacity: 1,
    })

    const fontSize = isHeader ? FONT_SIZE_TABLE + 1 : FONT_SIZE_TABLE
    const displayText = fitText(font, col.text, fontSize, col.width - 8)
    const tw = textWidth(font, displayText, fontSize)

    let textX = x + 4
    if (col.align === 'right') textX = x + col.width - tw - 4
    else if (col.align === 'center') textX = x + (col.width - tw) / 2

    page.drawText(displayText, {
      x: textX,
      y: y - rowHeight + 4 + (rowHeight - fontSize) / 2,
      size: fontSize,
      font,
      color: COLOR_BLACK,
    })

    x += col.width
  }
}

/** Draw a simple 2-column summary table */
function drawSummaryTable(
  page: PDFPage, font: PDFFont,
  rows: { label: string; value: string }[],
  startY: number,
  labelWidth: number,
  valueWidth: number,
  title?: string
): number {
  let y = startY
  const rowH = TABLE_LINE_HEIGHT + 2

  if (title) {
    page.drawText(title, { x: MARGIN_LEFT, y, size: FONT_SIZE, font, color: COLOR_BLACK })
    y -= LINE_HEIGHT
  }

  // Header
  drawTableRow(page, font, [
    { text: 'รายการ', width: labelWidth, align: 'center' },
    { text: 'จำนวน', width: valueWidth, align: 'center' },
  ], y, rowH, true)
  y -= rowH

  for (const row of rows) {
    drawTableRow(page, font, [
      { text: row.label, width: labelWidth, align: 'left' },
      { text: row.value, width: valueWidth, align: 'right' },
    ], y, rowH)
    y -= rowH
  }

  return y
}

// ============================= Page Number Helper =============================
function drawPageNumbers(pdfDoc: PDFDocument, font: PDFFont) {
  const pages = pdfDoc.getPages()
  const total = pages.length
  for (let i = 0; i < total; i++) {
    const page = pages[i]
    const text = `หน้า ${i + 1} จาก ${total}`
    const tw = textWidth(font, text, FONT_SIZE_SMALL)
    page.drawText(text, {
      x: PAGE_W - MARGIN_RIGHT - tw,
      y: MARGIN_BOTTOM - mm(5),
      size: FONT_SIZE_SMALL,
      font,
      color: COLOR_GRAY_TEXT,
    })
  }
}

// ============================= Route =============================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const monthParam = Number(url.searchParams.get('month'))
    const yearParam = Number(url.searchParams.get('year')) // พ.ศ.

    if (!monthParam || monthParam < 1 || monthParam > 12 || !yearParam || yearParam < 2500) {
      return new Response(
        JSON.stringify({ success: false, message: 'กรุณาระบุ month (1-12) และ year (พ.ศ.)' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    const yearCE = yearParam - 543
    const monthIndex = monthParam - 1
    const thaiMonthName = THAI_MONTHS_FULL[monthIndex]

    const pool = getPool()

    // =================== Query data ===================

    // 1) Total reports in month
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM reports WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?`,
      [monthParam, yearCE]
    )
    const totalReports = Number(totalRows[0]?.total || 0)

    if (totalReports === 0) {
      return new Response(
        JSON.stringify({ success: false, message: `ไม่มีข้อมูลคำร้องในเดือน${thaiMonthName} พ.ศ. ${yearParam}` }),
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // 2) Status breakdown
    const [statusRows] = await pool.execute<StatusRow[]>(
      `SELECT status, COUNT(*) AS count FROM reports WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? GROUP BY status ORDER BY count DESC`,
      [monthParam, yearCE]
    )

    // 3) Request type breakdown
    const [typeRows] = await pool.execute<TypeRow[]>(
      `SELECT COALESCE(request_type, 'ไม่ระบุ') AS request_type, COUNT(*) AS count FROM reports WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? GROUP BY COALESCE(request_type, 'ไม่ระบุ') ORDER BY count DESC`,
      [monthParam, yearCE]
    )

    // 4) Category breakdown (Top 10)
    const [categoryRows] = await pool.execute<CategoryRow[]>(
      `SELECT c.category_name, COUNT(r.report_id) AS count FROM reports r LEFT JOIN categories c ON r.category_id = c.category_id WHERE MONTH(r.created_at) = ? AND YEAR(r.created_at) = ? GROUP BY c.category_id, c.category_name ORDER BY count DESC LIMIT 10`,
      [monthParam, yearCE]
    )

    // 5) All locations
    const [locationRows] = await pool.execute<LocationRow[]>(
      `SELECT incident_location, COUNT(*) AS count FROM reports WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? AND incident_location IS NOT NULL AND incident_location <> '' GROUP BY incident_location ORDER BY count DESC`,
      [monthParam, yearCE]
    )

    // 6) Processing time avg (SLA)
    const [processingTimeRows] = await pool.execute<ProcessingTimeRow[]>(
      `SELECT AVG(TIMESTAMPDIFF(DAY, r.created_at, s.first_approved_at)) AS avg_days
       FROM reports r
       JOIN (
         SELECT sh.report_id, MIN(sh.changed_at) AS first_approved_at
         FROM status_history sh WHERE sh.new_status = 'เอกสารอนุมัติเรียบร้อย' GROUP BY sh.report_id
       ) s ON s.report_id = r.report_id
       WHERE MONTH(r.created_at) = ? AND YEAR(r.created_at) = ?`,
      [monthParam, yearCE]
    )
    const avgDays = processingTimeRows[0]?.avg_days != null ? Number(processingTimeRows[0].avg_days) : null

    // 7) Rejected cases with reason (for detail section)
    const [rejectedRows] = await pool.execute<RejectedRow[]>(
      `SELECT report_id, full_name, created_at, rejection_reason
       FROM reports
       WHERE status = 'ปฏิเสธคำร้อง'
         AND MONTH(created_at) = ? AND YEAR(created_at) = ?
       ORDER BY created_at ASC`,
      [monthParam, yearCE]
    )

    // =================== Build PDF ===================
    const pdfDoc = await PDFDocument.create()
    const font = await loadThaiFont(pdfDoc)

    // ============ Page 1: Header + Summary ============
    let page = pdfDoc.addPage([PAGE_W, PAGE_H])
    let y = PAGE_H - MARGIN_TOP

    // Title
    drawCentered(page, font, 'รายงานสรุปคำร้องขอดูภาพจากกล้องวงจรปิด (CCTV)', y, FONT_SIZE_HEADER)
    y -= LINE_HEIGHT * 1.3

    drawCentered(page, font, `ประจำเดือน${thaiMonthName} พ.ศ. ${yearParam}`, y, FONT_SIZE)
    y -= LINE_HEIGHT

    drawCentered(page, font, 'เทศบาลนครหัวหิน', y, FONT_SIZE)
    y -= LINE_HEIGHT * 0.8

    // Separator line
    drawHLine(page, y)
    y -= LINE_HEIGHT * 1.2

    // === Summary overview table ===
    const statusMap: Record<string, number> = {}
    for (const s of statusRows) statusMap[s.status] = Number(s.count)

    const approved = statusMap['เอกสารอนุมัติเรียบร้อย'] || 0
    const pendingDocs = statusMap['รอยื่นเอกสาร'] || 0
    const pending = statusMap['รอเอกสารอนุมัติ'] || 0
    const rejected = statusMap['ปฏิเสธคำร้อง'] || 0

    const pct = (n: number) => totalReports > 0 ? `${(n / totalReports * 100).toFixed(1)}%` : '0%'

    const labelW = CONTENT_W * 0.6
    const valueW = CONTENT_W * 0.4

    y = drawSummaryTable(page, font, [
      { label: 'จำนวนคำร้องทั้งหมด', value: `${totalReports} เรื่อง` },
      { label: 'อนุมัติ (เอกสารอนุมัติเรียบร้อย)', value: `${approved} เรื่อง (${pct(approved)})` },
      { label: 'รอดำเนินการ (รอยื่นเอกสาร)', value: `${pendingDocs} เรื่อง (${pct(pendingDocs)})` },
      { label: 'รอดำเนินการ (รอเอกสารอนุมัติ)', value: `${pending} เรื่อง (${pct(pending)})` },
      { label: 'ปฏิเสธ (ปฏิเสธคำร้อง)', value: `${rejected} เรื่อง (${pct(rejected)})` },
    ], y, labelW, valueW, '1. สรุปภาพรวมสถานะคำร้อง')

    y -= LINE_HEIGHT * 1.2

    // === Request type table ===
    if (typeRows.length > 0) {
      const typeData = typeRows.map(r => ({
        label: r.request_type || 'ไม่ระบุ',
        value: `${Number(r.count)} เรื่อง (${pct(Number(r.count))})`,
      }))
      y = drawSummaryTable(page, font, typeData, y, labelW, valueW, '2. ประเภทคำร้อง')
      y -= LINE_HEIGHT * 1.2
    }

    // === Category table (Top 10) ===
    if (categoryRows.length > 0) {
      // Check if we need a new page
      const neededHeight = (categoryRows.length + 2) * (TABLE_LINE_HEIGHT + 2) + LINE_HEIGHT * 2
      if (y - neededHeight < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN_TOP
      }

      const catData = categoryRows.map(r => ({
        label: r.category_name || 'ไม่ระบุ',
        value: `${Number(r.count)} เรื่อง (${pct(Number(r.count))})`,
      }))
      y = drawSummaryTable(page, font, catData, y, labelW, valueW, '3. หมวดหมู่เหตุการณ์ที่ถูกร้องขอ (Top 10)')
      y -= LINE_HEIGHT * 1.2
    }

    // === Location table (all) ===
    if (locationRows.length > 0) {
      const rowH = TABLE_LINE_HEIGHT + 2

      // Title + header need space
      if (y - LINE_HEIGHT * 2 - rowH < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN_TOP
      }

      page.drawText('4. สถานที่/จุดเกิดเหตุที่ถูกร้องขอ', { x: MARGIN_LEFT, y, size: FONT_SIZE, font, color: COLOR_BLACK })
      y -= LINE_HEIGHT

      // Header
      drawTableRow(page, font, [
        { text: 'รายการ', width: labelW, align: 'center' },
        { text: 'จำนวน', width: valueW, align: 'center' },
      ], y, rowH, true)
      y -= rowH

      for (const r of locationRows) {
        if (y - rowH < MARGIN_BOTTOM) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H])
          y = PAGE_H - MARGIN_TOP
          // Re-draw header on new page
          drawTableRow(page, font, [
            { text: 'รายการ', width: labelW, align: 'center' },
            { text: 'จำนวน', width: valueW, align: 'center' },
          ], y, rowH, true)
          y -= rowH
        }
        drawTableRow(page, font, [
          { text: r.incident_location, width: labelW, align: 'left' },
          { text: `${Number(r.count)} เรื่อง`, width: valueW, align: 'right' },
        ], y, rowH)
        y -= rowH
      }

      y -= LINE_HEIGHT * 1.2
    }

    // === SLA ===
    if (avgDays !== null) {
      if (y - LINE_HEIGHT * 3 < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN_TOP
      }

      page.drawText('5. เวลาดำเนินการเฉลี่ย (SLA)', { x: MARGIN_LEFT, y, size: FONT_SIZE, font, color: COLOR_BLACK })
      y -= LINE_HEIGHT
      page.drawText(`   เฉลี่ยตั้งแต่ยื่นคำร้องถึงอนุมัติ: ${avgDays.toFixed(1)} วัน`, {
        x: MARGIN_LEFT, y, size: FONT_SIZE, font, color: COLOR_BLACK,
      })
      y -= LINE_HEIGHT * 1.5
    }

    // === Rejected cases detail ===
    if (rejectedRows.length > 0) {
      const fontSize = FONT_SIZE_TABLE
      const dateFontSize = fontSize - 1
      const rowLine = fontSize * 1.4
      const padding = 5
      // 3 columns — name & submission date stack inside the "ผู้ยื่น" cell
      // so the reason cell gets ~22% more width for long text.
      const colW = {
        no: CONTENT_W * 0.06,
        who: CONTENT_W * 0.28,
        reason: CONTENT_W * 0.66,
      }

      const formatDateShortTH = (d: Date | string | null): string => {
        if (!d) return '-'
        const date = d instanceof Date ? d : new Date(d)
        if (isNaN(date.getTime())) return '-'
        const day = date.getDate()
        const month = THAI_MONTHS_SHORT[date.getMonth()]
        const yBE = date.getFullYear() + 543
        return `${day} ${month} ${yBE}`
      }

      const drawHeaderRow = (yTop: number): number => {
        const headerSize = fontSize + 1
        const headerH = rowLine + padding * 2
        let x = MARGIN_LEFT
        const headers: { text: string; width: number }[] = [
          { text: 'ลำดับ', width: colW.no },
          { text: 'ผู้ยื่นคำร้อง / วันที่ยื่น', width: colW.who },
          { text: 'เหตุผลที่ปฏิเสธ', width: colW.reason },
        ]
        for (const h of headers) {
          page.drawRectangle({
            x, y: yTop - headerH,
            width: h.width, height: headerH,
            color: COLOR_GRAY_HEADER,
            borderColor: COLOR_BLACK, borderWidth: 0.5,
            borderOpacity: 1,
          })
          const tw = textWidth(font, h.text, headerSize)
          page.drawText(h.text, {
            x: x + (h.width - tw) / 2,
            y: yTop - padding - headerSize,
            size: headerSize, font, color: COLOR_BLACK,
          })
          x += h.width
        }
        return yTop - headerH
      }

      // Title + ensure space for at least the header
      if (y - LINE_HEIGHT * 2 - rowLine * 3 < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN_TOP
      }

      page.drawText(`6. รายการคำร้องที่ปฏิเสธพร้อมเหตุผล (${rejectedRows.length} เรื่อง)`, {
        x: MARGIN_LEFT, y, size: FONT_SIZE, font, color: COLOR_BLACK,
      })
      y -= LINE_HEIGHT
      y = drawHeaderRow(y)

      for (let i = 0; i < rejectedRows.length; i++) {
        const r = rejectedRows[i]
        const noText = String(i + 1)
        const nameText = (r.full_name ?? '').trim() || '-'
        const dateText = formatDateShortTH(r.created_at)
        const reasonText = (r.rejection_reason ?? '').trim() || 'ไม่ระบุเหตุผล'

        const nameLines = wrapText(font, nameText, fontSize, colW.who - padding * 2)
        const reasonLines = wrapText(font, reasonText, fontSize, colW.reason - padding * 2)
        // The "who" cell visually has nameLines + a date line below
        const whoVisualLines = nameLines.length + 1
        const maxLines = Math.max(1, whoVisualLines, reasonLines.length)
        const rowH = maxLines * rowLine + padding * 2

        // Page break if row won't fit
        if (y - rowH < MARGIN_BOTTOM) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H])
          y = PAGE_H - MARGIN_TOP
          y = drawHeaderRow(y)
        }

        // Row borders — three side-by-side rectangles
        let x = MARGIN_LEFT
        for (const w of [colW.no, colW.who, colW.reason]) {
          page.drawRectangle({
            x, y: y - rowH,
            width: w, height: rowH,
            borderColor: COLOR_BLACK, borderWidth: 0.5,
            borderOpacity: 1,
            opacity: 0,
          })
          x += w
        }

        // No. — vertically centered, single line
        {
          const tw = textWidth(font, noText, fontSize)
          page.drawText(noText, {
            x: MARGIN_LEFT + (colW.no - tw) / 2,
            y: y - rowH / 2 - fontSize / 2 + 1,
            size: fontSize, font, color: COLOR_BLACK,
          })
        }

        // Who — name (top, bold weight via same font but full color) + date (bottom, gray)
        {
          const cellX = MARGIN_LEFT + colW.no
          let lineY = y - padding - fontSize
          for (const lineText of nameLines) {
            page.drawText(lineText, {
              x: cellX + padding, y: lineY,
              size: fontSize, font, color: COLOR_BLACK,
            })
            lineY -= rowLine
          }
          page.drawText(dateText, {
            x: cellX + padding, y: lineY + (rowLine - dateFontSize) / 2,
            size: dateFontSize, font, color: COLOR_GRAY_TEXT,
          })
        }

        // Reason — wrapped lines
        {
          const cellX = MARGIN_LEFT + colW.no + colW.who
          let lineY = y - padding - fontSize
          for (const lineText of reasonLines) {
            page.drawText(lineText, {
              x: cellX + padding, y: lineY,
              size: fontSize, font, color: COLOR_BLACK,
            })
            lineY -= rowLine
          }
        }

        y -= rowH
      }

      y -= LINE_HEIGHT * 0.8
    }

    // ============ Page numbers ============
    drawPageNumbers(pdfDoc, font)

    // ============ Save & respond ============
    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)

    const fileName = `รายงานประจำเดือน${thaiMonthName}_${yearParam}.pdf`
    const asciiFileName = `monthly-report-${yearParam}-${String(monthParam).padStart(2, '0')}.pdf`
    const encodedFileName = encodeURIComponent(fileName)

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    console.error('Error generating monthly PDF:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้าง PDF รายงานประจำเดือน',
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
