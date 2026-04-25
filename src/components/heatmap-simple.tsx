'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type LeafletMap = import('leaflet').Map
type LeafletCircle = import('leaflet').Circle

interface HeatmapPoint {
  lat: number
  lng: number
  weight: number
}

interface HeatmapSimpleProps {
  map: LeafletMap | null
  filters?: {
    start?: string
    end?: string
    category?: string
    priority?: string
    precision?: number
    minWeight?: number
  }
  visible?: boolean
  maxRadius?: number // ขนาดวงกลมสูงสุด (เมตร)
  minRadius?: number // ขนาดวงกลมต่ำสุด (เมตร)
}

// สีตามระดับความรุนแรง
function getColorByWeight(weight: number, maxWeight: number): string {
  const ratio = weight / maxWeight
  if (ratio >= 0.8) return '#dc2626' // red-600
  if (ratio >= 0.6) return '#ea580c' // orange-600
  if (ratio >= 0.4) return '#ca8a04' // yellow-600
  if (ratio >= 0.2) return '#16a34a' // green-600
  return '#2563eb' // blue-600
}

export function HeatmapSimple({
  map,
  filters = {},
  visible = true,
  maxRadius = 100,
  minRadius = 30,
}: HeatmapSimpleProps) {
  const circlesRef = useRef<LeafletCircle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ total: number; maxWeight: number } | null>(null)

  useEffect(() => {
    if (!map || !visible) {
      // Clear all circles
      circlesRef.current.forEach(circle => map?.removeLayer(circle))
      circlesRef.current = []
      return
    }

    let isMounted = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        // Build query string
        const params = new URLSearchParams()
        if (filters.start) params.append('start', filters.start)
        if (filters.end) params.append('end', filters.end)
        if (filters.category) params.append('category', filters.category)
        if (filters.priority) params.append('priority', filters.priority)
        if (filters.precision) params.append('precision', String(filters.precision))
        if (filters.minWeight) params.append('minWeight', String(filters.minWeight))

        const response = await fetch(`/api/heatmap?${params}`)
        const result = await response.json()

        if (!isMounted) return

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch data')
        }

        const data: HeatmapPoint[] = result.data

        if (data.length === 0) {
          setError('ไม่พบข้อมูลในช่วงที่เลือก')
          setLoading(false)
          return
        }

        // Clear existing circles
        circlesRef.current.forEach(circle => map!.removeLayer(circle))
        circlesRef.current = []

        // Load Leaflet
        const L = await import('leaflet')

        // Calculate max weight for scaling
        const maxWeight = Math.max(...data.map(p => p.weight))
        const minWeight = Math.min(...data.map(p => p.weight))

        setStats({ total: data.length, maxWeight })

        // Create circles
        data.forEach(point => {
          const weight = point.weight
          const ratio = (weight - minWeight) / (maxWeight - minWeight || 1)
          const radius = minRadius + (ratio * (maxRadius - minRadius))
          const color = getColorByWeight(weight, maxWeight)

          const circle = L.circle([point.lat, point.lng], {
            radius: radius,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.6,
            fillOpacity: 0.4,
          }).addTo(map!)

          // Popup with info
          circle.bindPopup(`
            <div style="text-align: center;">
              <strong>${weight} ครั้ง</strong><br/>
              <small>(${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})</small>
            </div>
          `)

          circlesRef.current.push(circle)
        })

        // Fit bounds
        if (result.meta?.bounds) {
          const bounds = L.latLngBounds(
            [result.meta.bounds.minLat, result.meta.bounds.minLng],
            [result.meta.bounds.maxLat, result.meta.bounds.maxLng]
          )
          map!.fitBounds(bounds, { padding: [50, 50] })
        }

      } catch (err) {
        console.error('Heatmap error:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
      circlesRef.current.forEach(circle => {
        if (map) map.removeLayer(circle)
      })
      circlesRef.current = []
    }
  }, [map, visible, filters, maxRadius, minRadius])

  if (!visible) return null

  return (
    <>
      {/* Loading */}
      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-red-50 text-red-600 rounded-lg shadow-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && !loading && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-sm">
          <div className="font-medium mb-1">สถิติ Heatmap</div>
          <div className="text-slate-600">
            <div>จุดที่แสดง: {stats.total} จุด</div>
            <div>น้ำหนักสูงสุด: {stats.maxWeight}</div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span> ต่ำ
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-600"></span> ปานกลาง
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600"></span> สูง
            </span>
          </div>
        </div>
      )}
    </>
  )
}
