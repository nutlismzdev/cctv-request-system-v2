# Heatmap API Documentation

API สำหรับดึงข้อมูล Heatmap (Privacy-safe) ใช้กับระบบ GIS

## 🔒 Privacy & Security

- ❌ **ไม่มีข้อมูลส่วนบุคคล** (ไม่ส่งชื่อ, เบอร์โทร, เลขบัตรประชาชน)
- ✅ ส่งเฉพาะ `lat`, `lng`, `weight` เท่านั้น
- ✅ Aggregate ข้อมูลด้วย Grid-based grouping
- ✅ กรองข้อมูล `ปฏิเสธคำร้อง` ออกโดยอัตโนมัติ

---

## Endpoints

### 1. GET `/api/heatmap`

ดึงข้อมูล Heatmap points (Aggregated)

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start` | string | - | วันเริ่มต้น (YYYY-MM-DD) |
| `end` | string | - | วันสิ้นสุด (YYYY-MM-DD) |
| `category` | number | - | กรองตาม category_id |
| `priority` | string | - | กรองตาม priority (low/medium/high/urgent) |
| `precision` | number | 4 | ความละเอียด grid (3-6 decimal places) |
| `minWeight` | number | 1 | น้ำหนักขั้นต่ำที่แสดง |

#### Response Format

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
    "bounds": {
      "minLat": 12.5684,
      "maxLat": 12.5691,
      "minLng": 99.9577,
      "maxLng": 99.9582
    },
    "filters": {
      "start": "2026-01-01",
      "end": "2026-01-31",
      "category": "2",
      "priority": "high",
      "precision": 4
    }
  }
}
```

#### Examples

```bash
# ทั้งหมด (default precision=4)
GET /api/heatmap

# ช่วงวันที่
GET /api/heatmap?start=2026-01-01&end=2026-01-31

# กรองตามหมวดหมู่
GET /api/heatmap?category=2

# กรองตาม priority
GET /api/heatmap?priority=high

# ความละเอียดต่ำ (grid ใหญ่ขึ้น, น้ำหนักมากขึ้น)
GET /api/heatmap?precision=3

# กรองเฉพาะจุดที่มีเหตุ >= 5 ครั้ง
GET /api/heatmap?minWeight=5

# รวมทุก filter
GET /api/heatmap?start=2026-01-01&end=2026-01-31&category=2&priority=high&precision=4
```

---

### 2. GET `/api/heatmap/categories`

ดึงรายการหมวดหมู่ที่มีข้อมูล Heatmap (สำหรับ filter dropdown)

#### Response

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

## Grid Precision Guide

| Precision | Grid Size | Use Case |
|-----------|-----------|----------|
| 3 | ~111m x 111m | Overview, ดูภาพรวม |
| 4 | ~11m x 11m | Standard (แนะนำ) |
| 5 | ~1m x 1m | Detailed, จุดเฉพาะ |
| 6 | ~0.1m x 0.1m | Very detailed |

---

## Usage with Leaflet Heatmap Plugin

```javascript
// ตัวอย่างการใช้งานกับ Leaflet.heat
const response = await fetch('/api/heatmap?precision=4');
const result = await response.json();

const heatData = result.data.map(p => [p.lat, p.lng, p.weight]);

L.heatLayer(heatData, {
  radius: 25,
  blur: 15,
  maxZoom: 17,
  max: 10.0,
  gradient: {
    0.4: 'blue',
    0.6: 'cyan', 
    0.7: 'lime',
    0.8: 'yellow',
    1.0: 'red'
  }
}).addTo(map);
```

---

## Performance Notes

- ข้อมูลถูก Aggregate ที่ฐานข้อมูล → ลด payload
- ใช้ Index บน `latitude`, `longitude` (แนะนำให้สร้าง)
- ตัวกรอง `status != 'ปฏิเสธคำร้อง'` ถูกใช้โดยอัตโนมัติ
- แนะนำใช้ `precision=4` สำหรับทั่วไป
