// src/app/api/heatmap/route.ts
// API สำหรับดึงข้อมูล Heatmap (Privacy-safe, ไม่มีข้อมูลส่วนบุคคล)
// Aggregate ข้อมูลเป็น lat/lng/weight เท่านั้น

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

// Query parameters interface
interface HeatmapQueryParams {
  start?: string      // YYYY-MM-DD
  end?: string        // YYYY-MM-DD
  category?: string   // category_id
  priority?: string   // low, medium, high, urgent
  precision?: string  // grid precision (3-6 decimal places, default: 4)
  minWeight?: string  // minimum weight to include (default: 1)
}

// Response data structure
interface HeatmapPoint {
  lat: number
  lng: number
  weight: number
}

interface HeatmapResponse {
  success: boolean
  data: HeatmapPoint[]
  meta: {
    totalPoints: number
    totalWeight: number
    bounds?: {
      minLat: number
      maxLat: number
      minLng: number
      maxLng: number
    }
    filters: {
      start?: string
      end?: string
      category?: string
      priority?: string
      precision: number
    }
  }
  message?: string
}

/**
 * GET /api/heatmap
 * 
 * Query Parameters:
 * - start: Start date (YYYY-MM-DD) - optional
 * - end: End date (YYYY-MM-DD) - optional
 * - category: Category ID - optional
 * - priority: Priority level (low/medium/high/urgent) - optional
 * - precision: Grid precision 3-6 (default: 4) - optional
 * - minWeight: Minimum weight to include (default: 1) - optional
 * 
 * Example:
 * GET /api/heatmap
 * GET /api/heatmap?start=2026-01-01&end=2026-01-31
 * GET /api/heatmap?category=2&priority=high
 * GET /api/heatmap?precision=3&minWeight=2
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const params: HeatmapQueryParams = {
      start: url.searchParams.get('start') || undefined,
      end: url.searchParams.get('end') || undefined,
      category: url.searchParams.get('category') || undefined,
      priority: url.searchParams.get('priority') || undefined,
      precision: url.searchParams.get('precision') || '4',
      minWeight: url.searchParams.get('minWeight') || '1',
    }

    // Validate precision (3-6 decimal places)
    const precision = Math.min(Math.max(parseInt(params.precision || '4', 10), 3), 6)
    const minWeight = Math.max(parseInt(params.minWeight || '1', 10), 1)

    // Validate dates
    if (params.start && !isValidDate(params.start)) {
      return Response.json(
        { success: false, message: 'Invalid start date format (YYYY-MM-DD)' },
        { status: 400 }
      )
    }
    if (params.end && !isValidDate(params.end)) {
      return Response.json(
        { success: false, message: 'Invalid end date format (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Build query
    const conditions: string[] = [
      'latitude IS NOT NULL',
      'longitude IS NOT NULL',
      'latitude BETWEEN -90 AND 90',
      'longitude BETWEEN -180 AND 180'
    ]
    const queryParams: (string | number)[] = []

    // Date filter
    if (params.start) {
      conditions.push('created_at >= ?')
      queryParams.push(`${params.start} 00:00:00`)
    }
    if (params.end) {
      conditions.push('created_at <= ?')
      queryParams.push(`${params.end} 23:59:59`)
    }

    // Category filter
    if (params.category) {
      const categoryId = parseInt(params.category, 10)
      if (!isNaN(categoryId)) {
        conditions.push('category_id = ?')
        queryParams.push(categoryId)
      }
    }

    // Priority filter
    if (params.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent']
      if (validPriorities.includes(params.priority)) {
        conditions.push('priority = ?')
        queryParams.push(params.priority)
      }
    }

    // Status filter - exclude rejected by default for heatmap
    conditions.push('status != ?')
    queryParams.push('ปฏิเสธคำร้อง')

    // Build SQL query with grid-based aggregation
    // Using ROUND to group nearby coordinates into grid cells
    const sql = `
      SELECT 
        ROUND(latitude, ${precision}) as lat,
        ROUND(longitude, ${precision}) as lng,
        COUNT(*) as weight
      FROM reports
      WHERE ${conditions.join(' AND ')}
      GROUP BY 
        ROUND(latitude, ${precision}),
        ROUND(longitude, ${precision})
      HAVING weight >= ?
      ORDER BY weight DESC
    `

    queryParams.push(minWeight)

    // Execute query
    const [rows] = await getPool().execute<RowDataPacket[]>(sql, queryParams)

    // Transform to response format
    const heatmapData: HeatmapPoint[] = rows.map(row => ({
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      weight: parseInt(row.weight, 10)
    }))

    // Calculate bounds if data exists
    let bounds: HeatmapResponse['meta']['bounds'] | undefined
    if (heatmapData.length > 0) {
      bounds = {
        minLat: Math.min(...heatmapData.map(p => p.lat)),
        maxLat: Math.max(...heatmapData.map(p => p.lat)),
        minLng: Math.min(...heatmapData.map(p => p.lng)),
        maxLng: Math.max(...heatmapData.map(p => p.lng)),
      }
    }

    // Calculate totals
    const totalWeight = heatmapData.reduce((sum, p) => sum + p.weight, 0)

    const response: HeatmapResponse = {
      success: true,
      data: heatmapData,
      meta: {
        totalPoints: heatmapData.length,
        totalWeight,
        bounds,
        filters: {
          start: params.start,
          end: params.end,
          category: params.category,
          priority: params.priority,
          precision,
        }
      }
    }

    return Response.json(response)

  } catch (error) {
    console.error('Heatmap API error:', error)
    return Response.json(
      { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Heatmap',
        data: [],
        meta: { totalPoints: 0, totalWeight: 0, filters: { precision: 4 } }
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/heatmap/stats
 * สำหรับดึงสถิติสรุปของข้อมูล Heatmap (ไม่รวมรายละเอียดพิกัด)
 */
export async function HEAD(): Promise<Response> {
  try {
    const [result] = await getPool().execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(DISTINCT category_id) as total_categories,
        MIN(created_at) as earliest_date,
        MAX(created_at) as latest_date,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as reports_with_location
      FROM reports
      WHERE status != 'ปฏิเสธคำร้อง'
    `)

    return Response.json({
      success: true,
      stats: result[0]
    })
  } catch (error) {
    console.error('Heatmap stats error:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}

// Helper function to validate date format
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}
