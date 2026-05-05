export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, resolve, extname, relative } from 'node:path'
import { Readable } from 'node:stream'
import { requireAdmin } from '@/lib/auth-server'

const UPLOAD_ROOT = join(process.cwd(), 'public', 'uploads')

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
}

function getContentType(filename: string): string {
  const extension = extname(filename).toLowerCase()
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

interface ByteRange { start: number; end: number }

function parseRange(rangeHeader: string, fileSize: number): ByteRange | null {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!m) return null
  const startStr = m[1]
  const endStr = m[2]

  let start = startStr ? parseInt(startStr, 10) : Number.NaN
  let end = endStr ? parseInt(endStr, 10) : Number.NaN

  if (Number.isNaN(start) && Number.isNaN(end)) return null

  if (Number.isNaN(start)) {
    const suffix = end
    if (Number.isNaN(suffix)) return null
    start = Math.max(fileSize - suffix, 0)
    end = fileSize - 1
  } else {
    if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1
  }

  if (start < 0 || end < 0 || start > end || start >= fileSize) return null
  return { start, end }
}

function toReadableStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream as Readable) as ReadableStream<Uint8Array>
}

function createETag(size: number, mtimeMs: number) {
  return `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`
}

function buildHeaders(overrides: Record<string, string | number> = {}): HeadersInit {
  return {
    'Cache-Control': 'public, max-age=3600, must-revalidate',
    'Accept-Ranges': 'bytes',
    'Vary': 'Range',
    'Content-Disposition': 'inline',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',

    'Cross-Origin-Resource-Policy': 'same-origin',
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
  }
}

function isProtectedUploadPath(pathSegments: string[]): boolean {
  return pathSegments[0] === 'attachments'
}

function buildPrivateHeaders(overrides: Record<string, string | number> = {}): HeadersInit {
  return buildHeaders({
    'Cache-Control': 'private, no-store',
    ...overrides,
  })
}

/** ป้องกัน path traversal และบังคับให้อยู่ใต้ UPLOAD_ROOT */
async function resolveFilePath(pathSegments: string[]): Promise<{
  filePath: string; size: number; mtimeMs: number; filename: string
}> {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) throw new Error('Empty path')
  if (pathSegments.some(s => s.includes('..') || s.includes('\\'))) throw new Error('Invalid path')

  const relPath = pathSegments.join('/')
  const candidate = resolve(UPLOAD_ROOT, relPath)
  const rootResolved = resolve(UPLOAD_ROOT)

  const relToRoot = relative(rootResolved, candidate)
  if (relToRoot.startsWith('..') || relToRoot.includes('..' + '/')) throw new Error('Path escapes root')

  const st = await stat(candidate)
  if (!st.isFile()) throw new Error('Not a file')

  const filename = pathSegments[pathSegments.length - 1] || 'file'
  return { filePath: candidate, size: st.size, mtimeMs: st.mtimeMs, filename }
}

/** GET — โปรดสังเกตว่า params เป็น Promise และเราทำ await */
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await ctx.params
    const protectedFile = isProtectedUploadPath(pathSegments)
    if (protectedFile) {
      const guard = await requireAdmin(request)
      if ('response' in guard) return guard.response
    }

    let fileMeta: { filePath: string; size: number; mtimeMs: number; filename: string }
    try {
      fileMeta = await resolveFilePath(pathSegments)
    } catch (error) {
      console.error('File not found:', { pathSegments, error })
      return new Response('File not found', { status: 404 })
    }

    const contentType = getContentType(fileMeta.filename)
    const etag = createETag(fileMeta.size, fileMeta.mtimeMs)
    const lastModified = new Date(fileMeta.mtimeMs).toUTCString()

    const inm = request.headers.get('if-none-match')
    const ims = request.headers.get('if-modified-since')
    if (inm === etag || (ims && new Date(ims).getTime() >= fileMeta.mtimeMs)) {
      return new Response(null, {
        status: 304,
        headers: (protectedFile ? buildPrivateHeaders : buildHeaders)({
          'Content-Type': contentType,
          'ETag': etag,
          'Last-Modified': lastModified,
        }),
      })
    }

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const byteRange = parseRange(rangeHeader, fileMeta.size)
      if (!byteRange) {
        return new Response(null, {
          status: 416,
          headers: (protectedFile ? buildPrivateHeaders : buildHeaders)({
            'Content-Range': `bytes */${fileMeta.size}`,
            'ETag': etag,
            'Last-Modified': lastModified,
          }),
        })
      }

      const { start, end } = byteRange
      const chunkSize = end - start + 1
      try {
        const stream = createReadStream(fileMeta.filePath, { start, end })
        return new Response(toReadableStream(stream), {
          status: 206,
          headers: (protectedFile ? buildPrivateHeaders : buildHeaders)({
            'Content-Type': contentType,
            'Content-Length': chunkSize,
            'Content-Range': `bytes ${start}-${end}/${fileMeta.size}`,
            'ETag': etag,
            'Last-Modified': lastModified,
          }),
        })
      } catch (error) {
        console.error('Error creating range stream:', error)
        return new Response('Error serving partial content', { status: 500 })
      }
    }

    const stream = createReadStream(fileMeta.filePath)
    return new Response(toReadableStream(stream), {
      status: 200,
      headers: (protectedFile ? buildPrivateHeaders : buildHeaders)({
        'Content-Type': contentType,
        'Content-Length': fileMeta.size,
        'ETag': etag,
        'Last-Modified': lastModified,
      }),
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

/** HEAD — เช่นเดียวกัน ใช้ params: Promise แล้ว await */
export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await ctx.params
    const protectedFile = isProtectedUploadPath(pathSegments)
    if (protectedFile) {
      const guard = await requireAdmin(request)
      if ('response' in guard) return guard.response
    }

    const { filePath, size, mtimeMs, filename } = await resolveFilePath(pathSegments)
    const contentType = getContentType(filename)
    const etag = createETag(size, mtimeMs)
    const lastModified = new Date(mtimeMs).toUTCString()

    await stat(filePath)
    return new Response(null, {
      status: 200,
      headers: (protectedFile ? buildPrivateHeaders : buildHeaders)({
        'Content-Type': contentType,
        'Content-Length': size,
        'ETag': etag,
        'Last-Modified': lastModified,
      }),
    })
  } catch (error) {
    console.error('HEAD request failed:', { error })
    return new Response(null, { status: 404 })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: buildHeaders() })
}
