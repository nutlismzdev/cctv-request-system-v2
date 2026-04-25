# Heatmap API & Component Guide

## 📁 ไฟล์ที่สร้าง/แก้ไข

### Backend (API)
```
src/app/api/heatmap/route.ts                 # API หลักสำหรับ Heatmap
src/app/api/heatmap/categories/route.ts      # API สำหรับ Categories filter
src/app/api/heatmap/README.md                # API Documentation
```

### Frontend (Components)
```
src/components/heatmap-simple.tsx            # Component Heatmap (Circle-based)
src/components/heatmap-layer.tsx             # Component Heatmap (ใช้กับ leaflet.heat)
src/app/admin/heatmap/page.tsx               # หน้า Heatmap สำหรับ Admin
```

---

## 🔌 API Endpoints

### 1. `GET /api/heatmap`
ดึงข้อมูล Heatmap แบบ Aggregated

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start` | string | - | วันเริ่ม (YYYY-MM-DD) |
| `end` | string | - | วันสิ้นสุด (YYYY-MM-DD) |
| `category` | number | - | category_id |
| `priority` | string | - | low/medium/high/urgent |
| `precision` | number | 4 | ความละเอียด grid (3-6) |
| `minWeight` | number | 1 | น้ำหนักขั้นต่ำ |

**Response:**
```json
{
  "success": true,
  "data": [
    { "lat": 12.5684, "lng": 99.9577, "weight": 12 },
    { "lat": 12.5691, "lng": 99.9582, "weight": 5 }
  ],
  "meta": {
    "totalPoints": 2,
    "totalWeight": 17,
    "bounds": { "minLat": 12.568, "maxLat": 12.570, "minLng": 99.957, "maxLng": 99.959 },
    "filters": { "precision": 4, ... }
  }
}
```

**Examples:**
```bash
# ทั้งหมด
GET /api/heatmap

# กรองวันที่
GET /api/heatmap?start=2026-01-01&end=2026-01-31

# กรองหมวดหมู่
GET /api/heatmap?category=2

# ความละเอียดต่ำ (grid ใหญ่)
GET /api/heatmap?precision=3
```

### 2. `GET /api/heatmap/categories`
ดึงรายการหมวดหมู่ที่มีข้อมูล Heatmap

**Response:**
```json
{
  "success": true,
  "data": [
    { "category_id": 1, "category_name": "อุบัติเหตุ", "count": 45 },
    { "category_id": 2, "category_name": "ทรัพย์สินสูญหาย", "count": 23 }
  ]
}
```

---

## 🎨 การใช้งาน Components

### HeatmapSimple (แนะนำ)
ใช้ Circle Markers แสดงผล (ไม่ต้องติดตั้ง library เพิ่ม)

```tsx
import { HeatmapSimple } from '@/components/heatmap-simple'

<HeatmapSimple
  map={map}                    // Leaflet Map instance
  visible={true}               // แสดง/ซ่อน
  filters={{                   // ตัวกรอง
    start: '2026-01-01',
    end: '2026-01-31',
    category: '2',
    priority: 'high',
    precision: 4,
  }}
  maxRadius={100}              // ขนาดวงกลมสูงสุด (เมตร)
  minRadius={30}               // ขนาดวงกลมต่ำสุด (เมตร)
/>
```

### HeatmapLayer (ต้องติดตั้ง leaflet.heat)
ใช้กับ plugin `leaflet.heat`

```bash
npm install leaflet.heat
npm install --save-dev @types/leaflet.heat
```

```tsx
import { HeatmapLayer } from '@/components/heatmap-layer'

<HeatmapLayer
  map={map}
  visible={true}
  filters={{...}}
  radius={25}
  blur={15}
  gradient={{ 0.4: 'blue', 0.6: 'cyan', 1.0: 'red' }}
/>
```

---

## 🗺️ หน้า Heatmap Admin

URL: `/admin/heatmap`

ฟีเจอร์:
- ✅ แสดง Heatmap บนแผนที่
- ✅ ตัวกรองวันที่
- ✅ ตัวกรองหมวดหมู่
- ✅ ตัวกรอง Priority
- ✅ ปรับความละเอียด Grid
- ✅ Legend แสดงระดับสี
- ✅ คลิกที่จุดดูจำนวนเหตุ

---

## 📊 Grid Precision Guide

| Precision | ขนาด Grid | ใช้สำหรับ |
|-----------|-----------|----------|
| 3 | ~111m | Overview ภาพรวม |
| 4 | ~11m | Standard (แนะนำ) |
| 5 | ~1m | Detailed |
| 6 | ~0.1m | Very detailed |

---

## 🔒 Privacy & Security

API นี้ถูกออกแบบมาเพื่อความปลอดภัย:

- ❌ ไม่ส่งชื่อ, เบอร์โทร, เลขบัตรประชาชน
- ❌ ไม่ส่ง report_id หรือรายละเอียดเหตุ
- ✅ ส่งเฉพาะ lat/lng/weight
- ✅ Aggregate ข้อมูลด้วย Grid
- ✅ กรองข้อมูล `ปฏิเสธคำร้อง` ออก

---

## 🚀 การติดตั้ง

### 1. รัน SQL Migration (ถ้ายังไม่ได้รัน)
```sql
-- ตรวจสอบว่ามีคอลัมน์ latitude/longitude แล้ว
DESCRIBE reports;
```

### 2. ติดตั้ง Dependencies (ถ้าใช้ HeatmapLayer)
```bash
npm install leaflet.heat
```

### 3. ทดสอบ API
```bash
# ทดสอบดึงข้อมูล
curl http://localhost:4000/api/heatmap

# ทดสอบกรอง
curl "http://localhost:4000/api/heatmap?start=2026-01-01&precision=4"
```

### 4. เปิดหน้า Heatmap
ไปที่: `http://localhost:4000/admin/heatmap`

---

## 📝 ตัวอย่างการใช้ API กับ GIS อื่นๆ

### Google Maps
```javascript
const response = await fetch('/api/heatmap');
const result = await response.json();

result.data.forEach(point => {
  new google.maps.Circle({
    center: { lat: point.lat, lng: point.lng },
    radius: 100,
    fillColor: getColorByWeight(point.weight),
    fillOpacity: 0.4,
    strokeWeight: 0,
    map: map
  });
});
```

### Mapbox
```javascript
map.addSource('heatmap', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: result.data.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { weight: p.weight }
    }))
  }
});
```

---

## 🔧 Troubleshooting

**ไม่มีข้อมูลแสดง:**
- ตรวจสอบว่ามี reports ที่มี latitude/longitude หรือไม่
- ตรวจสอบ filter date range
- ลองปรับ precision ต่ำลง

**API Error:**
- ตรวจสอบ database connection
- ดู logs ที่ console

**Performance:**
- ใช้ precision=3 ถ้าข้อมูลเยอะ
- กรองวันที่ให้แคบลง
- ใช้ minWeight กรองจุดที่มีเหตุน้อยออก
