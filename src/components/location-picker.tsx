'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MapPin, Crosshair, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Types for Leaflet (avoid importing directly to prevent SSR issues)
type LeafletMap = import('leaflet').Map
type LeafletMarker = import('leaflet').Marker

interface LocationPickerProps {
  latitude?: number | null
  longitude?: number | null
  onLocationSelect: (lat: number, lng: number) => void
  height?: string
  readOnly?: boolean
  verifiedBy?: string | null
  verifiedAt?: string | null
}

// Default center (Hua Hin, Thailand)
const DEFAULT_CENTER = { lat: 12.5684, lng: 99.9577 }
const DEFAULT_ZOOM = 13

// Create red marker icon using div with emoji
const createCustomIcon = (L: typeof import('leaflet')) => {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: '<div style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export function LocationPicker({
  latitude,
  longitude,
  onLocationSelect,
  height = '400px',
  readOnly = false,
  verifiedBy,
  verifiedAt,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentLatLng, setCurrentLatLng] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  )

  // Load Leaflet dynamically on client side
  useEffect(() => {
    let isMounted = true

    async function loadLeaflet() {
      try {
        const L = await import('leaflet')
        if (!isMounted) return

        // Import CSS (dynamic import to avoid SSR issues)
        // Import CSS (dynamic import to avoid SSR issues)
        import('leaflet/dist/leaflet.css').catch(() => {})

        setLeaflet(L)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load Leaflet:', error)
        setIsLoading(false)
      }
    }

    loadLeaflet()

    return () => {
      isMounted = false
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!leaflet || !mapContainerRef.current || mapRef.current) return

    const center = currentLatLng || DEFAULT_CENTER

    const map = leaflet.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: currentLatLng ? 16 : DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })

    // Add tile layer (OpenStreetMap)
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Add marker if location exists
    if (currentLatLng) {
      const marker = leaflet.marker([currentLatLng.lat, currentLatLng.lng], {
        draggable: !readOnly,
        icon: createCustomIcon(leaflet),
      }).addTo(map)

      if (!readOnly) {
        marker.on('dragend', (e) => {
          const latLng = e.target.getLatLng()
          setCurrentLatLng({ lat: latLng.lat, lng: latLng.lng })
          onLocationSelect(latLng.lat, latLng.lng)
        })
      }

      markerRef.current = marker
    }

    // Handle map click to set location (if not readonly)
    if (!readOnly) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        setCurrentLatLng({ lat, lng })
        onLocationSelect(lat, lng)

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          const marker = leaflet.marker([lat, lng], { 
            draggable: true,
            icon: createCustomIcon(leaflet),
          }).addTo(map)
          marker.on('dragend', (e) => {
            const latLng = e.target.getLatLng()
            setCurrentLatLng({ lat: latLng.lat, lng: latLng.lng })
            onLocationSelect(latLng.lat, latLng.lng)
          })
          markerRef.current = marker
        }
      })
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [leaflet, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker when props change
  useEffect(() => {
    if (!leaflet || !mapRef.current) return

    if (latitude && longitude) {
      const newLatLng = { lat: latitude, lng: longitude }
      setCurrentLatLng(newLatLng)

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude])
      } else {
        const marker = leaflet.marker([latitude, longitude], {
          draggable: !readOnly,
          icon: createCustomIcon(leaflet),
        }).addTo(mapRef.current)

        if (!readOnly) {
          marker.on('dragend', (e) => {
            const latLng = e.target.getLatLng()
            setCurrentLatLng({ lat: latLng.lat, lng: latLng.lng })
            onLocationSelect(latLng.lat, latLng.lng)
          })
        }

        markerRef.current = marker
      }

      mapRef.current.panTo([latitude, longitude])
    }
  }, [latitude, longitude, leaflet, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get current location using browser geolocation
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setCurrentLatLng({ lat: latitude, lng: longitude })
        onLocationSelect(latitude, longitude)

        if (mapRef.current && leaflet) {
          mapRef.current.setView([latitude, longitude], 16)

          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude])
          } else {
            const marker = leaflet.marker([latitude, longitude], { 
              draggable: true,
              icon: createCustomIcon(leaflet),
            }).addTo(mapRef.current)
            marker.on('dragend', (e) => {
              const latLng = e.target.getLatLng()
              setCurrentLatLng({ lat: latLng.lat, lng: latLng.lng })
              onLocationSelect(latLng.lat, latLng.lng)
            })
            markerRef.current = marker
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        alert('ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบการอนุญาตให้เข้าถึงตำแหน่ง')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-slate-100 rounded-lg border-2 border-dashed border-slate-300"
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2" />
          <p className="text-sm text-slate-500">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ✅ Marker styles moved to globals.css */}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="rounded-lg border border-slate-200 overflow-hidden"
        style={{ height }}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            className="h-9"
          >
            <Crosshair className="h-4 w-4 mr-2" />
            ใช้ตำแหน่งปัจจุบัน
          </Button>
        )}

        {currentLatLng && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-red-500" />
            <span className="font-mono text-slate-600">
              {currentLatLng.lat.toFixed(6)}, {currentLatLng.lng.toFixed(6)}
            </span>
          </div>
        )}

        {!currentLatLng && !readOnly && (
          <span className="text-sm text-amber-600 flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            คลิกบนแผนที่เพื่อปักหมุด
          </span>
        )}
      </div>

      {/* Verification Info */}
      {verifiedBy && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
          <CheckCircle2 className="h-4 w-4" />
          <span>ยืนยันพิกัดโดย {verifiedBy}</span>
          {verifiedAt && (
            <span className="text-green-500">
              เมื่อ {new Date(verifiedAt).toLocaleDateString('th-TH')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
