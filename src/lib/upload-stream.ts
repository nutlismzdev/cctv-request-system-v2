/**
 * Streaming multipart/form-data parser for Next.js App Router (Node runtime).
 *
 * Why this exists:
 *   `await req.formData()` in Next.js buffers the entire request body in RAM
 *   before the handler runs. A 122MB video balloons to ~350-500MB of heap
 *   (FormData copy + arrayBuffer copy + Uint8Array copy), which causes long
 *   GC pauses and makes XHR upload progress appear stuck at ~1% on the client
 *   even though bytes are already sitting in the kernel/proxy buffer.
 *
 * What this does:
 *   Pipes the request body straight into busboy, which streams each file part
 *   to disk via fs.createWriteStream. RAM stays at ~64KB per chunk regardless
 *   of file size. The first 32 bytes of every file are intercepted for magic-
 *   byte sniffing so we can reject spoofed MIME types without buffering.
 */

import Busboy from 'busboy'
import { Readable } from 'stream'
import { createWriteStream } from 'fs'
import { unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import type { NextRequest } from 'next/server'
import {
  detectFileKind,
  MAX_SIZE,
  MIN_SIZE,
  MAX_FILES_PER_REQUEST,
  type FileKind,
} from './file-validation'

export interface StreamedFile {
  /** Original filename from the upload form. */
  originalName: string
  /** Bare filename written to disk (no directory). */
  storedName: string
  /** Absolute path on disk. */
  storedPath: string
  /** Bytes actually written. */
  size: number
  /** MIME from magic bytes (trusted), not from the form (spoofable). */
  detectedMime: string
  kind: FileKind
}

export interface StreamedField {
  name: string
  value: string
}

export interface StreamUploadOptions {
  /** Absolute directory to write files into. Created if missing. */
  uploadDir: string
  /** Allowed file kinds based on magic-byte detection. */
  allowed: FileKind[]
  /** Generate a unique filename from the original name. */
  generateFilename: (originalName: string) => string
}

export interface StreamUploadResult {
  files: StreamedFile[]
  /** Plain form fields (non-file parts). `getAll`-style: same name may appear multiple times. */
  fields: StreamedField[]
  /** Files that arrived but were rejected (bad magic / too big / bad name). */
  rejected: { originalName: string; reason: string }[]
}

export class UploadStreamError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// Hoisted: filename hygiene regex (Windows + POSIX path-traversal chars).
// Allocated once at module load instead of per file part (js-hoist-regexp).
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]/

/**
 * Build a Node Readable from a Next.js Web Request body.
 * App Router gives us a Web ReadableStream; busboy needs a Node stream.
 */
function nodeBodyFromRequest(req: NextRequest): Readable {
  if (!req.body) {
    throw new UploadStreamError('คำขอไม่มี body', 400)
  }
  // Readable.fromWeb is available on Node 18+ (Next 15 requires Node 18.18+).
  return Readable.fromWeb(req.body as unknown as import('stream/web').ReadableStream)
}

/**
 * Stream-parse a multipart request, writing every file part to disk.
 *
 * Limits enforced (matches @/lib/file-validation):
 *  - per-file max size by kind (image 10MB, pdf 20MB, video 500MB)
 *  - min size 64 bytes
 *  - first 32 bytes must match a known magic signature in `allowed`
 *  - max MAX_FILES_PER_REQUEST file parts
 *
 * On any hard error (limit exceeded, disk error) every partial file written
 * during this call is unlinked before the promise rejects.
 */
export async function parseMultipartStream(
  req: NextRequest,
  opts: StreamUploadOptions
): Promise<StreamUploadResult> {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new UploadStreamError('Content-Type ต้องเป็น multipart/form-data', 400)
  }

  await mkdir(opts.uploadDir, { recursive: true })

  const files: StreamedFile[] = []
  const fields: StreamedField[] = []
  const rejected: { originalName: string; reason: string }[] = []
  /** Files we've started writing — used for cleanup on error. */
  const writtenPaths: string[] = []

  // The largest allowed kind sets busboy's hard fileSize limit. Per-kind limits
  // are re-checked after magic-byte detection (a "video" header on a 600MB file
  // still gets rejected since busboy lets it through up to this ceiling).
  const hardFileSizeLimit = Math.max(...opts.allowed.map(k => MAX_SIZE[k]))

  const bb = Busboy({
    headers: { 'content-type': contentType },
    limits: {
      fileSize: hardFileSizeLimit,
      files: MAX_FILES_PER_REQUEST,
      fields: 50,
      fieldSize: 1 * 1024 * 1024, // 1MB per text field
    },
  })

  const body = nodeBodyFromRequest(req)

  // Cleanup helper: unlink everything written so far. Best-effort.
  const cleanupOnError = async () => {
    await Promise.allSettled(writtenPaths.map(p => unlink(p).catch(() => {})))
  }

  /** First-chunk magic-byte sniff. Buffers up to 32 bytes, then becomes pass-through. */
  function makeSniffer(onDetect: (head: Uint8Array) => void) {
    let collected = 0
    const HEAD_BYTES = 32
    let head: Uint8Array | null = new Uint8Array(HEAD_BYTES)
    let detected = false
    return new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (!detected && head) {
          const need = HEAD_BYTES - collected
          const take = Math.min(need, chunk.length)
          head.set(chunk.subarray(0, take), collected)
          collected += take
          if (collected >= HEAD_BYTES) {
            onDetect(head)
            head = null
            detected = true
          }
        }
        cb(null, chunk)
      },
      flush(cb) {
        // File shorter than 32 bytes — still try to detect on what we have.
        if (!detected && head) {
          onDetect(head.subarray(0, collected))
          head = null
          detected = true
        }
        cb()
      },
    })
  }

  const filePromises: Promise<void>[] = []

  bb.on('file', (_fieldname, fileStream, info) => {
    const originalName = info.filename || 'unnamed'

    // Reject path-traversal-ish names BEFORE we open a write stream.
    if (originalName.length > 255 || UNSAFE_FILENAME_CHARS.test(originalName)) {
      rejected.push({ originalName, reason: 'ชื่อไฟล์ไม่ปลอดภัย' })
      fileStream.resume() // drain & discard
      return
    }

    const storedName = opts.generateFilename(originalName)
    const storedPath = join(opts.uploadDir, storedName)

    let detectedKind: FileKind | null = null
    let detectedMime = ''
    let bytesWritten = 0
    let kindRejected = false

    const sniffer = makeSniffer((head) => {
      const detected = detectFileKind(head)
      if (!detected) {
        kindRejected = true
        rejected.push({ originalName, reason: 'ไม่สามารถระบุประเภทไฟล์ได้ (magic bytes ไม่ตรง)' })
        fileStream.resume()
        return
      }
      if (!opts.allowed.includes(detected.kind)) {
        kindRejected = true
        rejected.push({
          originalName,
          reason: `ไม่อนุญาตให้อัปโหลดไฟล์ประเภท ${detected.mime}`,
        })
        fileStream.resume()
        return
      }
      detectedKind = detected.kind
      detectedMime = detected.mime
    })

    const writeStream = createWriteStream(storedPath)
    writtenPaths.push(storedPath)

    // Track how much we wrote so we can flag size-mismatch / over-limit.
    sniffer.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length
    })

    fileStream.on('limit', () => {
      // busboy hit the hard fileSize ceiling — tear this file's pipeline down.
      kindRejected = true
      rejected.push({
        originalName,
        reason: `ไฟล์ขนาดใหญ่เกิน ${(hardFileSizeLimit / (1024 * 1024)).toFixed(0)}MB`,
      })
      writeStream.destroy()
    })

    const p = pipeline(fileStream, sniffer, writeStream)
      .then(async () => {
        if (kindRejected) {
          await unlink(storedPath).catch(() => {})
          return
        }
        if (!detectedKind) {
          await unlink(storedPath).catch(() => {})
          rejected.push({ originalName, reason: 'ไม่พบ magic bytes' })
          return
        }
        if (bytesWritten < MIN_SIZE) {
          await unlink(storedPath).catch(() => {})
          rejected.push({ originalName, reason: 'ไฟล์มีขนาดเล็กเกินไป' })
          return
        }
        // Per-kind size limit (e.g. 600MB "video" header → still rejected).
        if (bytesWritten > MAX_SIZE[detectedKind]) {
          await unlink(storedPath).catch(() => {})
          rejected.push({
            originalName,
            reason: `ไฟล์ขนาดใหญ่เกิน ${MAX_SIZE[detectedKind] / (1024 * 1024)}MB`,
          })
          return
        }
        files.push({
          originalName,
          storedName,
          storedPath,
          size: bytesWritten,
          detectedMime,
          kind: detectedKind,
        })
      })
      .catch(async (err) => {
        await unlink(storedPath).catch(() => {})
        // Don't throw here — let other files in the same upload finish, and
        // surface the error via `rejected[]` instead of nuking the whole batch.
        rejected.push({
          originalName,
          reason: err instanceof Error ? err.message : 'เขียนไฟล์ไม่สำเร็จ',
        })
      })

    filePromises.push(p)
  })

  bb.on('field', (name, value) => {
    fields.push({ name, value })
  })

  // Drive busboy from the request body, then wait for every file pipeline to settle.
  try {
    await new Promise<void>((resolve, reject) => {
      bb.once('error', reject)
      bb.once('close', resolve)
      bb.once('filesLimit', () => {
        reject(new UploadStreamError(`อัปโหลดได้สูงสุด ${MAX_FILES_PER_REQUEST} ไฟล์ต่อครั้ง`, 400))
      })
      body.once('error', reject)
      body.pipe(bb)
    })
    await Promise.all(filePromises)
  } catch (err) {
    await cleanupOnError()
    if (err instanceof UploadStreamError) throw err
    throw new UploadStreamError(
      err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผลไฟล์',
      400
    )
  }

  return { files, fields, rejected }
}
