// src/lib/auth.ts
// Authentication utilities for admin access
// ✅ Cached localStorage reads to avoid repeated DOM access (js-cache-storage)

export interface AdminUser {
  id: number
  username: string
  role: string
  name: string
}

// ✅ In-memory cache for localStorage values
let _cachedToken: string | null | undefined = undefined  // undefined = not yet read
let _cachedUser: AdminUser | null | undefined = undefined

function _invalidateCache(): void {
  _cachedToken = undefined
  _cachedUser = undefined
}

function _getCachedToken(): string | null {
  if (_cachedToken !== undefined) return _cachedToken
  if (typeof window === 'undefined') return null
  try {
    _cachedToken = localStorage.getItem('admin_token')
  } catch {
    _cachedToken = null
  }
  return _cachedToken
}

function _getCachedUser(): AdminUser | null {
  if (_cachedUser !== undefined) return _cachedUser
  if (typeof window === 'undefined') return null
  try {
    const userStr = localStorage.getItem('admin_user')
    _cachedUser = userStr ? (JSON.parse(userStr) as AdminUser) : null
  } catch {
    _cachedUser = null
  }
  return _cachedUser
}

// Check if user is authenticated (client-side)
export function isAuthenticated(): boolean {
  return !!_getCachedToken()
}

// Get current admin user info
export function getCurrentUser(): AdminUser | null {
  return _getCachedUser()
}

// Login function - password only
export async function login(
  password: string
): Promise<{ success: boolean; token?: string; user?: AdminUser; message?: string }> {
  try {
    // Simple password validation - no API call needed
    if (password === '77110') {
      const token = `admin_session_${Date.now()}`
      const user: AdminUser = {
        id: 1,
        username: 'admin',
        role: 'administrator',
        name: 'ผู้ดูแลระบบ',
      }

      // Store auth data
      localStorage.setItem('admin_token', token)
      localStorage.setItem('admin_user', JSON.stringify(user))

      // ✅ Update cache immediately
      _cachedToken = token
      _cachedUser = user

      return {
        success: true,
        token,
        user,
      }
    }

    return {
      success: false,
      message: 'รหัสผ่านไม่ถูกต้อง',
    }
  } catch {
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
    }
  }
}

// Logout function
export function logout(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')

  // ✅ Clear cache on logout
  _invalidateCache()
}

// Get auth headers for API requests
export function getAuthHeaders(): Record<string, string> {
  const token = _getCachedToken()

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}