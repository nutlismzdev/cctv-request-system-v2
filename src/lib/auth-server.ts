// Server-only auth helpers. Do NOT import from client components.
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type JWTPayload } from 'jose'

const COOKIE_NAME = 'admin_session'
const ALG = 'RS256'
const SESSION_TTL = '15m'
const SESSION_TTL_SECONDS = 15 * 60
const ISSUER = 'https://cctv-huahin.local/admin'
const AUDIENCE = 'https://cctv-huahin.local/api'
const CLOCK_TOLERANCE_SECONDS = 30
const KEY_ID = process.env.ADMIN_JWT_KEY_ID || 'admin-rs256-v1'

export interface AdminTokenPayload extends JWTPayload {
  sub: string
  role: 'administrator'
  name: string
}

type VerifiedAdminToken = {
  payload: AdminTokenPayload
  token: string
  exp: number
}

type RevokedToken = { exp: number }

const globalForAuth = globalThis as typeof globalThis & {
  adminRevokedTokens?: Map<string, RevokedToken>
}

const revokedTokens = globalForAuth.adminRevokedTokens ?? new Map<string, RevokedToken>()
globalForAuth.adminRevokedTokens = revokedTokens

function normalizePem(value: string | undefined, envName: string): string {
  if (!value) throw new Error(`${envName} must be set`)
  const pem = value.includes('\\n') ? value.replace(/\\n/g, '\n') : value
  if (!pem.includes('-----BEGIN') || !pem.includes('-----END')) {
    throw new Error(`${envName} must be a PEM encoded key`)
  }
  return pem
}

async function getPrivateKey() {
  return importPKCS8(normalizePem(process.env.ADMIN_JWT_PRIVATE_KEY, 'ADMIN_JWT_PRIVATE_KEY'), ALG)
}

async function getPublicKey() {
  return importSPKI(normalizePem(process.env.ADMIN_JWT_PUBLIC_KEY, 'ADMIN_JWT_PUBLIC_KEY'), ALG)
}

function cleanupRevokedTokens(now = Math.floor(Date.now() / 1000)) {
  for (const [jti, record] of revokedTokens.entries()) {
    if (record.exp <= now) revokedTokens.delete(jti)
  }
}

function isTokenRevoked(jti: unknown): boolean {
  if (typeof jti !== 'string' || !jti) return true
  cleanupRevokedTokens()
  return revokedTokens.has(jti)
}

export function revokeAdminJti(jti: string, exp: number) {
  if (!jti || !Number.isFinite(exp)) return
  cleanupRevokedTokens()
  revokedTokens.set(jti, { exp })
}

export async function signAdminToken(payload: Omit<AdminTokenPayload, 'iat' | 'exp' | 'nbf' | 'iss' | 'aud' | 'jti'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG, typ: 'JWT', kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(SESSION_TTL)
    .sign(await getPrivateKey())
}

export async function verifyAdminTokenDetailed(token: string): Promise<VerifiedAdminToken | null> {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, await getPublicKey(), {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
      typ: 'JWT',
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    })
    if (protectedHeader.alg !== ALG || protectedHeader.typ !== 'JWT' || protectedHeader.kid !== KEY_ID) {
      return null
    }
    if (
      payload.sub !== 'admin' ||
      payload.role !== 'administrator' ||
      typeof payload.name !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      typeof payload.nbf !== 'number' ||
      typeof payload.jti !== 'string' ||
      isTokenRevoked(payload.jti)
    ) {
      return null
    }
    return { payload: payload as AdminTokenPayload, token, exp: payload.exp }
  } catch {
    return null
  }
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  const verified = await verifyAdminTokenDetailed(token)
  return verified?.payload ?? null
}

/** Read admin session from server-side cookies (RSC / route handlers). */
export async function getAdminFromCookies(): Promise<AdminTokenPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminToken(token)
}

/** Read admin session from a NextRequest (middleware / API routes). */
export async function getAdminFromRequest(req: NextRequest): Promise<AdminTokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminToken(token)
}

export async function getVerifiedAdminTokenFromRequest(req: NextRequest): Promise<VerifiedAdminToken | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminTokenDetailed(token)
}

/**
 * Guard for API route handlers. Returns the admin payload, or a Response that the
 * handler should return immediately when not authorized.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ admin: AdminTokenPayload } | { response: Response }> {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return {
      response: Response.json(
        { success: false, message: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      ),
    }
  }
  return { admin }
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
export const ADMIN_SESSION_TTL_SECONDS = SESSION_TTL_SECONDS
