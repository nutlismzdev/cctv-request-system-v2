'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { checkAuth as verifyAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Filter, Map as MapIcon, Calendar, BarChart3 } from 'lucide-react'
import { HeatmapSimple } from '@/components/heatmap-simple'

type LeafletMap = import('leaflet').Map

interface Category {
  category_id: number
  category_name: string
  count: number
}

export default function HeatmapPage() {
  const router = useRouter()
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMap | null>(null)
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [precision, setPrecision] = useState('4')

  // Check auth
  useEffect(() => {
    let cancelled = false
    verifyAuth().then(user => {
      if (cancelled) return
      if (!user) router.push('/login')
    })
    return () => { cancelled = true }
  }, [router])

  // Load Leaflet
  useEffect(() => {
    let isMounted = true

    async function loadLeaflet() {
      try {
        const L = await import('leaflet')
        await import('leaflet/dist/leaflet.css')
        if (!isMounted) return
        setLeaflet(L)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load Leaflet:', error)
        toast.error('โหลดแผนที่ไม่สำเร็จ')
        setLoading(false)
      }
    }

    loadLeaflet()
    loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!leaflet || !mapContainerRef.current || mapRef.current) return

    // Hua Hin center
    const map = leaflet.map(mapContainerRef.current, {
      center: [12.5684, 99.9577],
      zoom: 13,
      scrollWheelZoom: true,
    })

    // Add tile layer
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [leaflet])

  async function loadCategories() {
    try {
      const res = await fetch('/api/heatmap/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const handleApplyFilters = useCallback(() => {
    // Force re-render of HeatmapSimple by changing key
    // This is handled automatically by useEffect in HeatmapSimple
  }, [])

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setCategory('all')
    setPriority('all')
    setPrecision('4')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Heatmap การเกิดเหตุ</h1>
                <p className="text-sm text-slate-500">แสดงความหนาแน่นของการเกิดเหตุตามพิกัด</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push('/admin/request')}>
              กลับหน้ารายการ
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Panel */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                ตัวกรองข้อมูล
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  ช่วงวันที่
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="วันเริ่มต้น"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="วันสิ้นสุด"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">หมวดหมู่</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={String(cat.category_id)}>
                        {cat.category_name} ({cat.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ความเร่งด่วน</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="low">ต่ำ</SelectItem>
                    <SelectItem value="medium">ปานกลาง</SelectItem>
                    <SelectItem value="high">สูง</SelectItem>
                    <SelectItem value="urgent">เร่งด่วน</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Precision */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ความละเอียด Grid</label>
                <Select value={precision} onValueChange={setPrecision}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">ต่ำ (~110m)</SelectItem>
                    <SelectItem value="4">ปานกลาง (~11m)</SelectItem>
                    <SelectItem value="5">สูง (~1m)</SelectItem>
                    <SelectItem value="6">สูงมาก (~0.1m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  className="flex-1" 
                  onClick={handleApplyFilters}
                >
                  <MapIcon className="h-4 w-4 mr-2" />
                  แสดง Heatmap
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleResetFilters}
                >
                  ล้าง
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              <div 
                ref={mapContainerRef}
                className="h-[600px] w-full rounded-lg"
              />
              
              {/* Heatmap Layer */}
              {mapRef.current && leaflet && (
                <HeatmapSimple
                  map={mapRef.current}
                  visible={true}
                  filters={{
                    start: startDate || undefined,
                    end: endDate || undefined,
                    category: category === 'all' ? undefined : category,
                    priority: priority === 'all' ? undefined : priority,
                    precision: parseInt(precision),
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-sm font-medium">ระดับความถี่:</div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[var(--primary)]"></span>
                <span className="text-sm">ต่ำ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-green-600"></span>
                <span className="text-sm">ปานกลางต่ำ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-yellow-600"></span>
                <span className="text-sm">ปานกลางสูง</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-600"></span>
                <span className="text-sm">สูง</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-red-600"></span>
                <span className="text-sm">สูงมาก</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
