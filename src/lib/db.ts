/**
 * Database Connection Module (updated for LINK VIA URL flow)
 */
import mysql from 'mysql2/promise'

export type DatabasePool = mysql.Pool
export type DatabaseConnection = mysql.Connection
export type QueryResult<T = unknown> = T[]

function envValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value || fallback
}

function createDbConfig() {
  return {
    host: envValue('DB_HOST', 'localhost'),
    user: envValue('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: envValue('DB_NAME', 'cctv_huahin'),
    port: parseInt(envValue('DB_PORT', '3306'), 10),
    charset: 'utf8mb4',
    timezone: '+07:00',
    connectTimeout: 30000,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    multipleStatements: false,
  }
}

function globalPoolState() {
  return globalThis as unknown as {
    __MYSQL_POOL__?: mysql.Pool
    __MYSQL_POOL_SIGNATURE__?: string
  }
}

function configSignature(config: ReturnType<typeof createDbConfig>): string {
  return JSON.stringify({
    host: config.host,
    user: config.user,
    database: config.database,
    port: config.port,
  })
}

let pool: mysql.Pool | null = null
export function getPool(): mysql.Pool {
  const dbConfig = createDbConfig()
  const signature = configSignature(dbConfig)
  const g = globalPoolState()

  if (pool && g.__MYSQL_POOL_SIGNATURE__ === signature) return pool

  if (g.__MYSQL_POOL__ && g.__MYSQL_POOL_SIGNATURE__ !== signature) {
    g.__MYSQL_POOL__.end().catch(() => {})
    g.__MYSQL_POOL__ = undefined
  }

  if (!g.__MYSQL_POOL__) {
    g.__MYSQL_POOL__ = mysql.createPool(dbConfig)
    g.__MYSQL_POOL_SIGNATURE__ = signature
  }
  pool = g.__MYSQL_POOL__
  return pool
}
export const db = getPool
export function resetPool(): void {
  const g = globalPoolState()
  g.__MYSQL_POOL__ = undefined
  g.__MYSQL_POOL_SIGNATURE__ = undefined
  pool = null
}

export async function query<T = unknown>(sql: string, params: unknown[] = [], retryCount = 0): Promise<T[]> {
  const maxRetries = 2
  let connection: mysql.PoolConnection | undefined
  try {
    const pool = getPool()
    connection = await pool.getConnection()
    const [rows] = await connection.execute(sql, params as unknown[])
    if (process.env.NODE_ENV === 'development') console.log(`[DB] Query executed: ${sql.substring(0, 60)}...`)
    return rows as unknown as T[]
  } catch (error) {
    console.error(`Database query error (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)
    if (retryCount < maxRetries && isRetryableError(error)) {
      await new Promise(res => setTimeout(res, 1000))
      return query<T>(sql, params, retryCount + 1)
    }
    throw error
  } finally {
    if (connection) { try { connection.release() } catch (e) { console.error('Error releasing connection:', e) } }
  }
}
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    return m.includes('connection') || m.includes('timeout') || m.includes('server has gone away')
  }
  return false
}

export async function testConnection(): Promise<boolean> {
  try { await query<{ test: number }>('SELECT 1 as test'); return true } catch { return false }
}
export async function closeConnection(): Promise<void> {
  try { if (pool) { await pool.end(); resetPool() } } catch { resetPool() }
}

/* =================== Secure Link Flow (LINE) =================== */

/** ให้/คืนเลขไอดีภายในของ line_users จาก line_user_id_str */
export async function getOrCreateLineUserNumericId(lineUserIdStr: string): Promise<number> {
  const [u] = await getPool().execute(
    'SELECT line_user_id FROM line_users WHERE line_user_id_str = ? LIMIT 1',
    [lineUserIdStr]
  ) as mysql.RowDataPacket[][]
  if (u.length > 0) return u[0].line_user_id as number

  const [ins] = await getPool().execute(
    'INSERT INTO line_users (line_user_id_str, is_friend, friend_added_at, last_active_at) VALUES (?, true, NOW(), NOW())',
    [lineUserIdStr]
  ) as mysql.ResultSetHeader[]
  return ins.insertId
}

/**
 * 🔐 ผูกคำร้องด้วย link_code (Transaction + FOR UPDATE)
 * เงื่อนไข: ยังไม่ผูก, link_code_used=0, ไม่หมดอายุ, สถานะ 'รอดำเนินการ'
 */
export async function secureLinkReportByCode(
  reportId: number,
  linkCode: string,
  lineUserIdStr: string,
  operation: 'line_postback_link' | 'liff_confirm_link',
  actorIdStr?: string,
): Promise<{ success: boolean }> {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.execute(
      `SELECT report_id
         FROM reports
        WHERE report_id = ?
          AND link_code = ?
          AND link_code_used = 0
          AND line_user_id IS NULL
          AND (link_code_expires_at IS NULL OR link_code_expires_at > NOW())
          AND status = 'รอดำเนินการ'
        FOR UPDATE`,
      [reportId, linkCode]
    ) as mysql.RowDataPacket[][]

    if (!rows || rows.length === 0) {
      throw new Error('INVALID_OR_USED_OR_EXPIRED')
    }

    // สร้าง/ดึง numeric id ของ LINE user
    const numericId = await (async () => {
      const [u] = await conn.execute(
        'SELECT line_user_id FROM line_users WHERE line_user_id_str = ? LIMIT 1',
        [lineUserIdStr]
      ) as mysql.RowDataPacket[][]
      if (u.length > 0) return u[0].line_user_id as number

      const [ins] = await conn.execute(
        'INSERT INTO line_users (line_user_id_str, is_friend, friend_added_at, last_active_at) VALUES (?, true, NOW(), NOW())',
        [lineUserIdStr]
      ) as mysql.ResultSetHeader[]
      return ins.insertId
    })()

    const [upd] = await conn.execute(
      `UPDATE reports
          SET line_user_id = ?, link_code_used = 1, linked_at = NOW(), updated_at = NOW(), updated_by = ?
        WHERE report_id = ?
          AND link_code = ?
          AND link_code_used = 0
          AND line_user_id IS NULL`,
      [numericId, actorIdStr || lineUserIdStr, reportId, linkCode]
    ) as mysql.ResultSetHeader[]

    if (upd.affectedRows !== 1) throw new Error('UPDATE_FAILED')

    await conn.commit()

    // บันทึกกิจกรรม (แยกจากทรานแซกชัน — fire-and-forget)
    getPool().execute(
      `INSERT INTO activity_logs (
        activity_type, entity_type, entity_id,
        actor_type, actor_id, action, description,
        metadata, ip_address
      ) VALUES (
        'report_updated', 'report', ?,
        'applicant', ?, 'SECURE_LINE_LINK_SUCCESS',
        ?,
        JSON_OBJECT('operation', ?, 'line_user_id_str', ?, 'linked_at', NOW()),
        'secure_link_system'
      )`,
      [
        reportId,
        actorIdStr || lineUserIdStr,
        `SECURE: Linked via ${operation}`,
        operation,
        lineUserIdStr
      ]
    ).catch(() => { /* ignore logging error */ })

    return { success: true }
  } catch (e) {
    try { await conn.rollback() } catch {}
    throw e
  } finally {
    conn.release()
  }
}

/* ===== (ไม่ใช้แล้วในฟลว์นี้ แต่คงไว้กันเรียกผิด) ===== */
export async function secureUpdateLineUserId(): Promise<{ success: boolean; reportId: number; lineUserId: number; operation: string }> {
  throw new Error('secureUpdateLineUserId is deprecated. Use secureLinkReportByCode() instead.')
}

export async function secureResetLineUserId(reportId: number, reason: string): Promise<void> {
  // ✅ Promise.all: UPDATE และ INSERT log ไม่ต้องรอกัน
  await Promise.all([
    getPool().execute(
      'UPDATE reports SET line_user_id = NULL, updated_at = NOW(), updated_by = ? WHERE report_id = ?',
      ['security_reset_system', reportId]
    ),
    getPool().execute(
      `INSERT INTO activity_logs (
        activity_type, entity_type, entity_id,
        actor_type, actor_id, action, description,
        metadata, ip_address
      ) VALUES (
        'security_incident', 'report', ?,
        'system', 'security_system', 'SECURE_LINE_LINK_RESET',
        ?,
        JSON_OBJECT('reason', ?),
        'secure_reset_system'
      )`,
      [reportId, `SECURE RESET: ${reason}`, reason]
    ),
  ])
}
