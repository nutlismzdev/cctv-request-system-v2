/**
 * Client-side helper สำหรับส่ง diagnostic log ไปบันทึกที่ logs/liff-debug.log
 * - sendBeacon เป็นหลัก (ทนต่อ navigation ของ LIFF redirect) → fallback fetch keepalive
 * - serialize Error เป็น object (รวม name, message, stack, code)
 */

type Loggable = unknown

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & { code?: string }
    return {
      __error: true,
      name: e.name,
      message: e.message,
      code: e.code,
      stack: e.stack,
    }
  }
  if (err && typeof err === 'object') return err as Record<string, unknown>
  return { value: String(err) }
}

function serializePayload(label: string, data: Record<string, Loggable>): string {
  const out: Record<string, unknown> = { label, t: Date.now() }
  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Error ? serializeError(v) : v
  }
  try {
    out.url = typeof window !== 'undefined' ? window.location.href : ''
    out.path = typeof window !== 'undefined' ? window.location.pathname : ''
  } catch {}
  return JSON.stringify(out)
}

export function liffLog(label: string, data: Record<string, Loggable> = {}): void {
  if (typeof window === 'undefined') return
  const body = serializePayload(label, data)
  console.log('[liff-debug]', label, data)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon('/api/debug/liff-log', blob)
      if (ok) return
    }
  } catch {}
  try {
    void fetch('/api/debug/liff-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {}
}
