รายชื่อเจ้าหน้าที่: GET http://localhost:4000/api/admin/officers?active=true

รายการคำร้อง: GET http://localhost:4000/api/admin/requests?page=1&pageSize=20

รายละเอียดคำร้อง: GET http://localhost:4000/api/admin/requests/1

ไฟล์ CCTV ของคำร้อง: GET http://localhost:4000/api/admin/requests/1/cctv

เปลี่ยนสถานะไฟล์: PATCH /api/admin/requests/1/cctv/123 body: { "approval_status": "พร้อมใช้งาน" }

ลบไฟล์: DELETE /api/admin/requests/1/cctv/123

เอกสาร: GET /api/admin/requests/1/documents


  1. โหมด Grid เท่านั้น: /api/reports/[id]/pdf?mode=grid - จะแสดงเฉพาะเส้น grid ไม่มีข้อความ
  2. โหมดปกติ + Grid: /api/reports/[id]/pdf?mode=draw&debug=1 - จะแสดงทั้งข้อความและเส้น grid