# CCTV Request System Flow Overview

เอกสารนี้สรุป flow การทำงานปัจจุบันของระบบ หลังจากแยก flow ออกเป็น 2 ส่วนชัดเจน:

- `onsite flow` สำหรับใช้งานหน้างานจริง
- `online flow` สำหรับยื่นคำร้องออนไลน์ผ่าน LINE / LIFF

## 1. เป้าหมายของการแยก flow

ก่อนหน้านี้ระบบใช้ flow เดียวสำหรับทุกกรณี ทำให้เกิดปัญหาในช่องทางออนไลน์:

- ผู้ใช้ยื่นคำร้องแล้วไม่ add LINE
- ผู้ใช้ add LINE แล้วไม่ส่งข้อความเข้า OA
- คำร้องไม่ถูก map กับ `line_user_id`
- งานค้างอยู่ในสถานะที่ต้องรอ manual linking

ดังนั้นจึงแยก flow ออกเป็น 2 แบบ:

- `onsite` ใช้ flow เดิมต่อไป
- `online` ใช้ flow ใหม่แบบ `LIFF-first`

## 2. Route Map ปัจจุบัน

### 2.1 Online Flow

- `/request`
- `/request/status`
- `/request/status/result`

### 2.2 Onsite Flow

- `/request-onsite`
- `/request-onsite/status`
- `/request-onsite/status/result`
- `/success-onsite`
- `/liff-onsite/[reportId]/[token]`
- `/link-success-onsite`
- `/link-error-onsite`

### 2.3 Legacy / Shared LINE routes

- `/api/line/link`
- `/api/line/link-via-url`
- `/api/line/webhook`

## 3. Onsite Flow

Onsite flow คือ flow เดิมที่คงไว้สำหรับหน้างานจริง

### 3.1 ลำดับการทำงาน

1. ผู้ใช้เข้า `/request-onsite`
2. กรอกข้อมูลคำร้องแบบเดิม
3. submit ไปที่ `POST /api/reports`
4. ระบบบันทึกคำร้อง
5. redirect ไป `/success-onsite?id={reportId}`
6. หน้าสำเร็จแสดง QR / ปุ่มเพิ่มเพื่อน LINE
7. ถ้าผู้ใช้ทำ LIFF link แบบเดิม จะเข้า `/liff-onsite/[reportId]/[token]`
8. หรือถ้าผู้ใช้เชื่อมจากลิงก์ manual link จะจบที่ `/link-success-onsite` หรือ `/link-error-onsite`

### 3.2 ลักษณะสำคัญของ onsite flow

- ยังใช้แนวคิดเดิมเรื่อง QR / add friend เอง
- ยังรองรับ manual link
- ยังรองรับการเชื่อมคำร้องภายหลัง
- ถูกแยก route ออกจาก online flow เพื่อไม่ให้ปนกัน

## 4. Online Flow

Online flow ใหม่ถูกวางไว้บน `/request`

เป้าหมายคือ:

- ได้ `line_user_id` ตั้งแต่ก่อน submit
- บังคับให้ผู้ใช้เป็นเพื่อนกับ LINE OA ก่อนใช้งาน
- ไม่ต้องสแกน QR
- ไม่ต้องให้ผู้ใช้พิมพ์ข้อความหา OA
- เมื่อส่งคำร้องแล้วสามารถแจ้งผลผ่าน LINE ได้ทันที

### 4.1 ลำดับการทำงาน

1. ผู้ใช้เข้า `/request`
2. หน้า `/request` ตรวจว่าเปิดผ่าน LIFF หรือไม่
3. ถ้ายังไม่ login LINE ระบบจะเรียก `liff.login()`
4. ถ้าไม่ได้เปิดใน LIFF client จะ redirect ไป `https://liff.line.me/{LIFF_ID}`
5. ระบบเรียก:
   - `liff.init()`
   - `liff.getProfile()`
   - `liff.getFriendship()`
6. ถ้ายังไม่ add friend:
   - แสดงหน้า block
   - เหลือแค่ปุ่มเพิ่มเพื่อน LINE OA
   - ยังไม่สามารถกรอกฟอร์มได้
7. ถ้า add friend แล้ว:
   - เปิดฟอร์มยื่นคำร้อง
   - เก็บ `line_user_id_str` จาก LINE profile ไว้ใน form
8. ผู้ใช้กรอกฟอร์ม 4 ขั้นตอน
9. submit ไปที่ `POST /api/reports`
10. backend สร้างคำร้องพร้อมผูก `line_user_id` ตั้งแต่แรก
11. frontend อัปโหลดเอกสารแนบเพิ่มผ่าน `/api/reports/{id}/attachments`
12. แสดง success state บนหน้า `/request`

## 5. Online Form Steps

ฟอร์มใหม่บน `/request` ถูกแบ่งเป็น 4 step

### Step 1: ข้อมูลผู้ยื่นคำร้อง

ข้อมูลหลัก:

- คำนำหน้า
- ชื่อ-นามสกุล
- อายุ
- เบอร์โทรศัพท์
- เลขบัตรประชาชน/หนังสือเดินทาง
- สถานะการเกี่ยวข้อง
- ที่อยู่
- `line_user_id_str` จาก LINE

### Step 2: เอกสารประกอบ

ผู้ใช้ต้องแนบให้ครบ 3 รายการ:

1. สำเนาบันทึกประจำวัน
2. สำเนาบัตรประชาชน
3. รูปถ่ายใบหน้ายืนยันตัวตน

ถ้าเอกสารไม่ครบ จะไป step ถัดไปไม่ได้

### Step 3: รายละเอียดเหตุการณ์

ข้อมูลหลัก:

- หมวดหมู่เหตุการณ์
- ประเภทคำร้อง
- วันที่เกิดเหตุ
- เวลาที่เกิดเหตุ
- สถานที่เกิดเหตุ
- รายละเอียดเพิ่มเติม

### Step 4: ตรวจสอบก่อนส่ง

แสดงข้อมูลสรุป:

- ข้อมูลผู้ยื่น
- ข้อมูลเหตุการณ์
- รายการเอกสารที่แนบ
- checkbox ยินยอมก่อนส่งคำร้อง

## 6. Backend Flow ของ Online Submit

### 6.1 `POST /api/reports`

ตอนนี้ API รองรับ field เพิ่ม:

- `line_user_id_str`

backend จะทำงานดังนี้:

1. validate payload
2. ถ้ามี `line_user_id_str`
   - เรียก `getOrCreateLineUserNumericId()`
   - แปลงเป็น numeric `line_user_id`
3. insert ข้อมูลลง `reports`
4. บันทึก:
   - `line_user_id`
   - `tracking_token`
   - `link_code`
5. ถ้าเป็น online flow จะตั้ง `created_by = 'online_liff'`
6. ส่ง group notification ให้เจ้าหน้าที่ตาม flow เดิม

### 6.2 หมายเหตุเรื่อง auto-link reset

เดิมระบบมี logic ป้องกันการ auto-link ระหว่างสร้างคำร้อง

ตอนนี้ logic นั้นยังคงอยู่ แต่จะไม่ reset ถ้า request นี้ส่ง `line_user_id_str` มาตั้งแต่ต้น เพราะถือว่าเป็น online flow ที่ตั้งใจให้ผูกทันที

## 7. Attachment Upload Flow

หลังจากสร้างคำร้องสำเร็จ online flow จะ upload เอกสารแนบ 3 รายการทีละชุดไปที่:

- `POST /api/reports/{reportId}/attachments`

category ที่ใช้:

- `police`
- `idcopy`
- `selfie`

การ map ที่ backend:

- `police` -> `police_report`
- `idcopy` -> `id_card_copy`
- `selfie` -> `identity_verification_photo`

## 8. LINE / LIFF Integration

### 8.1 Online Flow

online flow ใช้ LINE เป็นแกนหลักตั้งแต่ก่อนเริ่มกรอกฟอร์ม:

- ใช้ LIFF login
- ใช้ LINE profile เพื่อได้ `userId`
- ใช้ friendship check เพื่อบังคับ add friend

ผลลัพธ์คือ:

- ไม่ต้อง QR
- ไม่ต้องค้นหาคำร้องจากแชต
- ไม่ต้อง manual mapping

### 8.2 Onsite / Legacy Flow

flow เดิมยังคงอยู่ในระบบ:

- ผู้ใช้ add friend เอง
- ผู้ใช้อาจเชื่อมคำร้องทีหลัง
- ยังมี manual link route
- ยังรองรับ webhook search/flex flow

## 9. Success / Link Separation

มีการแยก success และ link result ของ onsite ออกจาก online ชัดเจน

### Onsite

- `/success-onsite`
- `/link-success-onsite`
- `/link-error-onsite`

### Online

- success state แสดงใน `/request` โดยตรง

หมายเหตุ:

ถ้าต้องการแยก success page ของ online ในอนาคต สามารถเพิ่ม route ใหม่ เช่น `/success-online` ได้

## 10. File / Code ที่เปลี่ยนสำคัญ

### Online Flow

- `src/app/request/page.tsx`

### Onsite Flow

- `src/app/request-onsite/page.tsx`
- `src/app/request-onsite/status/page.tsx`
- `src/app/request-onsite/status/result/page.tsx`
- `src/app/success-onsite/page.tsx`
- `src/app/liff-onsite/[reportId]/[token]/page.tsx`
- `src/app/link-success-onsite/page.tsx`
- `src/app/link-error-onsite/page.tsx`

### Backend

- `src/app/api/reports/route.ts`
- `src/app/api/reports/[id]/attachments/route.ts`
- `src/app/api/line/link-via-url/route.ts`

## 11. สถานะปัจจุบัน

สิ่งที่ทำเสร็จแล้ว:

- แยก onsite flow ออกจาก online flow
- คง flow เดิมไว้สำหรับหน้างานจริง
- สร้าง online flow ใหม่บน `/request`
- บังคับ LINE / LIFF gate ก่อนเข้าใช้งาน
- เพิ่มขั้นตอนเอกสาร 3 รายการใน step 2
- ให้ backend รับ `line_user_id` ตั้งแต่ตอนสร้างคำร้อง
- รองรับ selfie document type

สิ่งที่ยังทำเพิ่มได้ในอนาคต:

- แยก success page ของ online ออกเป็น route เฉพาะ
- ทำ prefill profile จากฐานข้อมูลผู้ใช้ LINE
- เพิ่ม API `/api/user-profile?line_user_id=...`
- ทำ localized text ผ่าน messages/i18n ให้ครบทั้ง flow ใหม่
- ทำ retry / resume upload เอกสารในกรณีเน็ตหลุด FLOW_SYSTEM_OVERVIEW.md

## 12. สรุป

ระบบตอนนี้มี 2 flow ชัดเจน:

- `request-onsite` = flow เดิมสำหรับหน้างานจริง
- `request` = flow ออนไลน์ใหม่แบบ LIFF-first
 
แนวคิดหลักของ online flow คือ:

> บังคับรู้ตัวตน LINE และความสัมพันธ์กับ OA ก่อนเริ่มยื่นคำร้อง

ทำให้ลดปัญหา:

- ผู้ใช้ไม่ add LINE
- ผู้ใช้ไม่ส่งข้อความ
- คำร้องไม่ถูก map
- งานค้างรอ manual follow-up

