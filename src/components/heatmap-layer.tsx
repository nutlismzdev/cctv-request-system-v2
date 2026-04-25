'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Types for Leaflet and Leaflet.heat
type LeafletMap = import('leaflet').Map
type HeatLayer = import('leaflet').Layer

interface HeatmapPoint {
  lat: number
  lng: number
  weight: number
}

interface HeatmapLayerProps {
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
  radius?: number
  blur?: number
  maxZoom?: number
  gradient?: Record<number, string>
}

// Default gradient colors (blue -> cyan -> lime -> yellow -> red)
const DEFAULT_GRADIENT = {
  0.2: 'blue',
  0.4: 'cyan',
  0.6: 'lime',
  0.8: 'yellow',
  1.0: 'red'
}

export function HeatmapLayer({
  map,
  filters = {},
  visible = true,
  radius = 25,
  blur = 15,
  maxZoom = 17,
  gradient = DEFAULT_GRADIENT,
}: HeatmapLayerProps) {
  const heatLayerRef = useRef<HeatLayer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!map || !visible) {
      // Remove layer if exists
      if (heatLayerRef.current) {
        map?.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
      return
    }

    let isMounted = true

    async function loadHeatmap() {
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

        // Fetch data
        const response = await fetch(`/api/heatmap?${params}`)
        const result = await response.json()

        if (!isMounted) return

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch heatmap data')
        }

        // Transform data for Leaflet.heat
        const heatData = result.data.map((p: HeatmapPoint) => [p.lat, p.lng, p.weight])

        if (heatData.length === 0) {
          setError('ไม่พบข้อมูลในช่วงที่เลือก')
          setLoading(false)
          return
        }

        // Dynamically import leaflet.heat
        const L = await import('leaflet')
        await import('leaflet.heat')

        if (!isMounted) return

        // Remove existing layer
        if (heatLayerRef.current) {
          map!.removeLayer(heatLayerRef.current)
        }

        // Create new heat layer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const heatLayer = (L as any).heatLayer(heatData, {
          radius,
          blur,
          maxZoom,
          max: Math.max(...result.data.map((p: HeatmapPoint) => p.weight)),
          gradient,
        }).addTo(map!)

        heatLayerRef.current = heatLayer

        // Fit bounds if data exists
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

    loadHeatmap()

    return () => {
      isMounted = false
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [map, visible, filters, radius, blur, maxZoom, gradient])

  if (!visible) return null

  return (
    <>
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">กำลังโหลด Heatmap...</span>
        </div>
      )}

      {/* Error message */}
      {error && !loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-red-50 text-red-600 rounded-lg shadow-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}
    </>
  )
}
