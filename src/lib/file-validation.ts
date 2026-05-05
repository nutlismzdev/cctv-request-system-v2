/**
 * Server-side file validation: size, MIME whitelist, magic-byte sniffing.
 * Browser-supplied `file.type` is spoofable, so we sniff the first bytes.
 */

export type FileKind = 'image' | 'video' | 'pdf'

export interface FileValidationResult {
  valid: boolean
  kind?: FileKind
  detectedMime?: string
  reason?: string
}

const MB = 1024 * 1024

export const MAX_SIZE: Record<FileKind, number> = {
  image: 10 * MB,
  pdf: 20 * MB,
  video: 500 * MB,
}

export const MIN_SIZE = 64 // bytes — anything smaller can't be a real media file

const SIGNATURES: Array<{ mime: string; kind: FileKind; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', kind: 'image', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  kind: 'image', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif',  kind: 'image', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', kind: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  // WebM / Matroska
  { mime: 'video/webm',  kind: 'video', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  // RIFF (image/webp + video/x-msvideo) ตัดสินด้วย brand ที่ offset 8..12 — ดู detectFileKind
  // ISO BMFF (image/heic + video/mp4/mov/m4v) ตัดสินด้วย brand ที่ offset 8..12 — ดู detectFileKind
]

function matchesSignature(head: Uint8Array, sig: typeof SIGNATURES[number]): boolean {
  const off = sig.offset ?? 0
  if (head.length < off + sig.bytes.length) return false
  for (let i = 0; i < sig.bytes.length; i++) {
    if (head[off + i] !== sig.bytes[i]) return false
  }
  return true
}

// HEIF/HEIC brand codes per ISO/IEC 23008-12. Anything else with "ftyp" at offset 4
// that isn't on this list is treated as MP4/MOV-family video.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])
const QUICKTIME_BRAND = 'qt  '

/** Detect file kind by magic bytes. Returns the first matching signature. */
export function detectFileKind(head: Uint8Array): { kind: FileKind; mime: string } | null {
  for (const sig of SIGNATURES) {
    if (matchesSignature(head, sig)) {
      return { kind: sig.kind, mime: sig.mime }
    }
  }

  // RIFF container: differentiate WEBP vs AVI by brand at offset 8..12
  if (head.length >= 12 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
    const tag = String.fromCharCode(head[8], head[9], head[10], head[11])
    if (tag === 'WEBP') return { kind: 'image', mime: 'image/webp' }
    if (tag === 'AVI ') return { kind: 'video', mime: 'video/x-msvideo' }
  }

  // ISO BMFF container ("ftyp" at offset 4): differentiate HEIC vs MP4/MOV/M4V by brand at offset 8..12.
  // ลำดับ check ต้องอยู่ "หลัง" RIFF เพราะ ftyp ใช้ offset 4 ไม่ใช่ 0
  if (
    head.length >= 12 &&
    head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70
  ) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11])
    if (HEIC_BRANDS.has(brand)) return { kind: 'image', mime: 'image/heic' }
    if (brand === QUICKTIME_BRAND) return { kind: 'video', mime: 'video/quicktime' }
    // ทุก ftyp brand อื่น (isom, mp41, mp42, avc1, iso2, iso5, iso6, M4V , dash, etc.) → mp4
    return { kind: 'video', mime: 'video/mp4' }
  }

  return null
}

/**
 * Validate a single file. Reads the first 32 bytes to sniff the magic number,
 * checks size, and matches against the allowed kinds.
 */
export async function validateUploadedFile(
  file: File,
  allowed: FileKind[]
): Promise<FileValidationResult> {
  if (file.size < MIN_SIZE) {
    return { valid: false, reason: 'ไฟล์มีขนาดเล็กเกินไป' }
  }

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const detected = detectFileKind(head)
  if (!detected) {
    return { valid: false, reason: 'ไม่สามารถระบุประเภทไฟล์ได้ (magic bytes ไม่ตรง)' }
  }
  if (!allowed.includes(detected.kind)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      reason: `ไม่อนุญาตให้อัปโหลดไฟล์ประเภท ${detected.mime}`,
    }
  }

  if (file.size > MAX_SIZE[detected.kind]) {
    return {
      valid: false,
      kind: detected.kind,
      detectedMime: detected.mime,
      reason: `ไฟล์ขนาดใหญ่เกิน ${MAX_SIZE[detected.kind] / MB}MB`,
    }
  }

  return { valid: true, kind: detected.kind, detectedMime: detected.mime }
}

export const MAX_FILES_PER_REQUEST = 20
