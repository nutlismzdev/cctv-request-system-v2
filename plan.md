  ข้อสังเกตที่ยังเหลือ (ไม่ได้แก้ — กระทบโครงสร้างเยอะ)

  1. Client component ใหญ่ — admin/request/[id]/edit/page.tsx (1,791 บรรทัด) และ request/page.tsx (1,750 บรรทัด) ทั้งหมดเป็น
  client component เดียว ส่งทั้งบรรทัดไปที่ browser จะดีกว่าถ้าแยก server-rendered shell + client islands
  2. useCallback/useMemo น้อย — admin edit page มีแค่ 4 ตัวสำหรับโค้ด 1,791 บรรทัด — handlers ที่ส่งให้ child components ถูกสร้างใหม่ทุก
  render
  3. <img> แทน <Image> — request/page.tsx ใช้ <img> ในหลายที่ (preview รูป) — กรณีรูปจาก URL.createObjectURL ใช้ <img>
  ถูกต้องอยู่แล้วเพราะ Next Image ไม่ optimize blob URL

  หลัง deploy แล้ว run next build ดู bundle size และ chunk แยก จะเห็นความต่างชัดเจนจาก optimizePackageImports

    Best practices ที่ flow ปัจจุบัน "ยังไม่เป็นไปตาม"

  1. ไม่มี client-side image compression — selfie/รูปบัตร/บันทึกประจำวัน upload ตรงจากกล้องมือถือ ไฟล์ 3-10MB ต่อใบ × 3 ใบ ทำให้
  network ช้า — ควรใช้ <canvas> resize ลงเหลือ ~1600px ก่อน upload
  2. ไม่มี optimistic success state — UI รอจนกว่า upload เสร็จทั้งหมด ผู้ใช้ไม่เห็น progress รายไฟล์ — ควรแสดง progress bar รายไฟล์ขณะ
  upload
  3. Attachment route ทำ DB INSERT แบบ sequential ใน loop (api/reports/[id]/attachments/route.ts บรรทัด 249-291) — ถ้า
  client ส่งหลายไฟล์ต่อ request ก็ INSERT ทีละแถว ควร batch INSERT เป็น single query
  4. ไม่ทำ retry/resume upload ตามที่ FLOW_SYSTEM_OVERVIEW §11 ระบุว่ายังไม่ได้ทำ — ถ้าไฟล์ใหญ่/เน็ตหลุด ต้อง upload ใหม่ทั้งหมด
  5. Auto-link reset (secureResetLineUserId) เกิดเฉพาะกรณี edge — ถ้า line_user_id_str มาด้วย (online flow) ควร skip การ
  SELECT/UPDATE check ทั้งหมด ลด round trip ฟรีอีก 1 รอบใน online path

  ผลลัพธ์ที่คาดหวัง

  - เวลายื่นคำร้องของผู้ใช้ลดลงประมาณ 60-75% ในเครือข่ายปกติ
  - LINE API ล้ม/ช้า ไม่ทำให้ user ค้างที่ "กำลังยื่นคำร้อง" อีก
  - DB connection pool ปล่อยเร็วขึ้น (4 round trips → 1)