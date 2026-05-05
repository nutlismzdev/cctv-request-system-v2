// Client-side admin auth utilities. The session itself lives in an httpOnly cookie
// set by /api/admin/auth/login — these helpers only mirror user metadata for UI use.

export interface AdminUser {
  id: number
  username: string
  role: string
  name: string
}

const ADMIN_USER_KEY = 'admin_user'

let _cachedUser: AdminUser | null | undefined = undefined

function _invalidateCache(): void {
  _cachedUser = undefined
}

function _setCachedUser(user: AdminUser | null): void {
  _cachedUser = user
  if (typeof window === 'undefined') return
  if (user) sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(ADMIN_USER_KEY)
}

export function getCurrentUser(): AdminUser | null {
  if (_cachedUser !== undefined) return _cachedUser
  if (typeof window === 'undefined') return null
  try {
    const userStr = sessionStorage.getItem(ADMIN_USER_KEY)
    _cachedUser = userStr ? (JSON.parse(userStr) as AdminUser) : null
  } catch {
    _cachedUser = null
  }
  return _cachedUser
}

/**
 * Check if there is an active admin session by hitting the server.
 * Use this in protected pages instead of trusting sessionStorage.
 */
export async function checkAuth(): Promise<AdminUser | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/admin/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!res.ok) {
      _setCachedUser(null)
      return null
    }
    const data = await res.json()
    if (!data.authenticated || !data.user) {
      _setCachedUser(null)
      return null
    }
    _setCachedUser(data.user as AdminUser)
    return data.user as AdminUser
  } catch {
    _setCachedUser(null)
    return null
  }
}

/**
 * Synchronous best-effort check based on cached user metadata.
 * Server middleware is the actual gate — this is just for UI flicker prevention.
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null
}

export async function login(
  password: string
): Promise<{ success: boolean; user?: AdminUser; message?: string }> {
  if (!password) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' }
  }
  try {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'รหัสผ่านไม่ถูกต้อง',
      }
    }
    _setCachedUser(data.user as AdminUser)
    return { success: true, user: data.user as AdminUser }
  } catch {
    return { success: false, message: 'ไม่สามารถเข้าสู่ระบบได้' }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch {
    /* swallow — cookie will expire eventually */
  }
  _invalidateCache()
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_USER_KEY)
  }
}

export function getAuthHeaders(): Record<string, string> {
  return {}
}
