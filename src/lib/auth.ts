// src/lib/auth.ts

export interface AdminUser {
  id: number
  username: string
  role: string
  name: string
}

const ADMIN_SESSION_KEY = 'admin_session'
const ADMIN_USER_KEY = 'admin_user'

let _cachedUser: AdminUser | null | undefined = undefined

function _invalidateCache(): void {
  _cachedUser = undefined
}

function _getCachedUser(): AdminUser | null {
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

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY))
}

export function getCurrentUser(): AdminUser | null {
  return _getCachedUser() ?? {
    id: 1,
    username: 'admin',
    role: 'administrator',
    name: 'ผู้ดูแลระบบ',
  }
}

export async function login(
  password: string
): Promise<{ success: boolean; token?: string; user?: AdminUser; message?: string }> {
  if (!password) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' }
  }

  if (typeof window !== 'undefined') {
    const user: AdminUser = {
      id: 1,
      username: 'admin',
      role: 'administrator',
      name: 'ผู้ดูแลระบบ',
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
    sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
    _cachedUser = user
    return { success: true, token: 'admin_session', user }
  }

  return { success: false, message: 'ไม่สามารถเข้าสู่ระบบได้' }
}

export function logout(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(ADMIN_USER_KEY)
  _invalidateCache()
}

export function getAuthHeaders(): Record<string, string> {
  return {}
}
