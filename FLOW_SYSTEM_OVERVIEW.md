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
- `/liff-onsite/dispatch` ← QR landing (LIFF auto-link entrypoint, **route หลักของ onsite link flow**)
- `/liff-onsite/dispatch/[reportId]/[token]` (path-based fallback → redirect ไป query-based)
- `/liff-onsite/[reportId]/[token]` (legacy path-based link)
- `/link-success-onsite`
- `/link-error-onsite`

### 2.3 Legacy / Shared LINE routes

- `/api/line/link` ← รับ `is_friend` จาก client (ตั้งแต่ 2026-05)
- `/api/line/link-via-url`
- `/api/line/webhook`

## 3. Onsite Flow

Onsite flow ใช้โดยเจ้าหน้าที่กรอกแทนผู้ยื่น แล้วให้ผู้ยื่นสแกน QR ที่หน้าจอเพื่อผูก LINE user ของผู้ยื่นเข้ากับคำร้อง

### 3.1 ลำดับการทำงาน (ปัจจุบัน — link-first, friend-required-after)

1. เจ้าหน้าที่เข้า `/request-onsite` กรอกแทนผู้ยื่น
2. submit → `POST /api/reports` → บันทึกคำร้อง + สร้าง `tracking_token`
3. redirect ไป `/success-onsite?id={reportId}&token={trackingToken}`
4. หน้าสำเร็จ adapt ตามอุปกรณ์ที่เปิด:
   - **Desktop / tablet (officer mode, ~80%)**: แสดง QR เด่น encode URL `https://liff.line.me/{LIFF_ONSITE_ID}?reportId={id}&token={token}` — เจ้าหน้าที่ให้ผู้ยื่นใช้กล้อง LINE สแกนจากหน้าจอ
   - **Mobile (self-service, ~20%)**: ซ่อน QR แสดงปุ่มเขียวใหญ่ "เปิดใน LINE" ที่ link ตรงไป LIFF deep link → ผู้ยื่นกรอกเองบนมือถือกดปุ่มเดียวเปิด LINE app
   - Detection: `matchMedia('(max-width: 767px) and (pointer: coarse)')` — viewport เล็ก + touch input ทั้งคู่ต้อง match
5. ผู้ยื่นใช้กล้อง LINE สแกน QR (officer mode) หรือกดปุ่ม (self-service) → เปิด `/liff-onsite/dispatch?reportId=…&token=…`
6. `/liff-onsite/dispatch` ทำงาน (single-shot):
   - parse `reportId + token` จาก query / `liff.state` / sessionStorage
   - `liff.init()` + `liff.login()` ถ้ายังไม่ login
   - `liff.getProfile()` → ได้ `userId`
   - `liff.getFriendship()` → เก็บ `isFriend` (ไม่ block flow)
   - `POST /api/line/link` พร้อม `{ report_id, tracking_token, userId, is_friend }`
   - **คำร้องผูกกับ `line_user_id` ทันทีไม่ว่าจะเป็นเพื่อนหรือไม่** ← จุดที่เปลี่ยนจาก flow เดิม
7. หน้า dispatch แสดงผลตาม `isFriend`:
   - ถ้าเป็นเพื่อน → step `success` (close button)
   - ถ้ายังไม่เป็นเพื่อน → step `pending-friend`:
     - แสดงป้ายเขียว "ผูกคำร้องเรียบร้อย ✓"
     - กล่องเตือนสีเหลือง "หากไม่เพิ่มเพื่อน ส่งลิงก์วิดีโอให้ไม่ได้"
     - ปุ่ม "เพิ่มเพื่อน LINE OA" (`liff.openWindow` แบบ `external: false` → in-app window)
     - polling `getFriendship()` ทุก 2 วิ + listener `pageshow` / `visibilitychange` / `focus` → auto re-check
     - เมื่อตรวจพบ friend → ทรานสิชันไป `success` ทันทีโดยผู้ใช้ไม่ต้องกดอะไร
8. กรณี user ไม่ได้สแกน QR แต่ใช้ลิงก์ manual link → ใช้ legacy path `/liff-onsite/[reportId]/[token]` → จบที่ `/link-success-onsite` หรือ `/link-error-onsite`

### 3.2 ลักษณะสำคัญของ onsite flow ปัจจุบัน

- **คำร้อง link สำเร็จตั้งแต่สแกน QR ครั้งเดียว** — ไม่ต้องสแกนซ้ำ
- "เพิ่มเพื่อน LINE OA" ถูกบังคับเป็น **ขั้นตอนสุดท้าย** หลัง link (ไม่ใช่ก่อน) เพราะระบบส่งลิงก์วิดีโอผ่าน LINE OA ได้เฉพาะกับเพื่อนเท่านั้น
- Polling + page-visibility listener ทำให้กลับมาจาก add-friend window แล้ว auto-detect ได้เนียน ไม่ต้องกด "ตรวจสอบใหม่" เอง
- `external: false` ทำให้ add-friend page เปิดใน in-app window ของ LINE → กลับมา dispatch เนียน (เปลี่ยนจาก `external: true` เดิม)
- API `/api/line/link` รับ `is_friend` จาก client → DB `line_users.is_friend` สะท้อนค่าจริงตอน link (webhook follow event จะ sync เป็น true ภายหลังถ้าผู้ใช้กดเพิ่มเพื่อน)
- **`/success-onsite` adaptive ตามอุปกรณ์** — desktop/tablet เห็น QR เด่น (officer mode), mobile เห็นปุ่ม "เปิดใน LINE" เด่นโดยซ่อน QR (self-service) — ผู้ยื่นกรอกเองบนมือถือไม่ต้องบันทึก QR แล้วสแกนจากรูปอีก

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

### 8.1 Online Flow (`/request`)

online flow ใช้ LINE เป็นแกนหลักตั้งแต่ก่อนเริ่มกรอกฟอร์ม:

- ใช้ LIFF login
- ใช้ LINE profile เพื่อได้ `userId`
- ใช้ friendship check เพื่อบังคับ add friend ก่อนเปิดฟอร์ม
- **LIFF ID**: `NEXT_PUBLIC_LINE_LIFF_ID` (ปัจจุบัน `2009893013-vCBlMHC5`)

ผลลัพธ์คือ:

- ไม่ต้อง QR
- ไม่ต้องค้นหาคำร้องจากแชต
- ไม่ต้อง manual mapping

### 8.2 Onsite Flow (`/liff-onsite/dispatch`)

flow ใหม่แบบ link-first, friend-required-after:

- เจ้าหน้าที่กรอกแทน → QR เปิด LIFF onsite → คำร้องผูกทันที
- บังคับเพิ่มเพื่อนเป็นขั้นตอนสุดท้าย พร้อม polling auto-detect
- **LIFF ID**: `NEXT_PUBLIC_LINE_LIFF_ONSITE_ID` (ปัจจุบัน `2009893013-FBmGbusJ`)

ผลลัพธ์คือ:

- คำร้องผูกสำเร็จ 100% ตั้งแต่สแกน QR ครั้งเดียว
- ไม่มี race condition ระหว่าง user กับ workflow ของเจ้าหน้าที่
- ผู้ใช้ที่ไม่กดเพิ่มเพื่อน → คำร้องผูกแล้วแต่จะไม่ได้รับ push noti (ดู §8.4)

### 8.3 Legacy / Webhook Flow

ยังคงรองรับเพื่อ backward compatibility:

- manual link route (`/liff-onsite/[reportId]/[token]`)
- webhook search/flex flow (พิมพ์เลขคำร้องในแชต OA → ได้ Flex card ปุ่ม "เชื่อมคำร้อง")

### 8.4 Notification Send (Approval → Push)

`src/lib/line-notification.ts` `sendLineNotification()`:

1. ดึง `line_user_id_str` + `is_friend` จาก `line_users`
2. **ถ้า `is_friend = false`** → log `NOTIFICATION_SKIPPED_NOT_FRIEND` ใน `activity_logs` แล้ว return `{ skipped: true, reason: 'not_friend' }` — ไม่ยิง LINE API ที่จะ fail แน่ ๆ
3. ถ้า is_friend = true → ยิง `POST /v2/bot/message/push`
4. ถ้า LINE API คืน error → log `NOTIFICATION_FAILED` พร้อม error message ใน metadata (log ทุก env รวม production)

จุดสำคัญ:
- Admin หน้า edit คำร้อง (`/admin/request/[id]/edit`) เห็น **badge สถานะ LINE link** ที่ EditPageHeader:
  - 🟢 **เขียว** "ผูกแล้ว — เป็นเพื่อน" (ส่ง noti ได้)
  - 🟡 **เหลือง** "ผู้ยื่นยังไม่ได้เพิ่มเพื่อน LINE OA — ส่งลิงก์วิดีโออัตโนมัติไม่ได้" (ต้อง follow-up)
  - ⚪ **เทา** "ยังไม่ผูก" (คำร้องไม่มี LINE link)

ให้ admin เห็นล่วงหน้าก่อนกดอนุมัติ ลด silent failure

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
- `src/app/liff-onsite/dispatch/page.tsx` ← link-first + pending-friend + polling (2026-05)
- `src/app/liff-onsite/dispatch/[reportId]/[token]/page.tsx` (path-based redirector)
- `src/app/liff-onsite/[reportId]/[token]/page.tsx` (legacy)
- `src/app/link-success-onsite/page.tsx`
- `src/app/link-error-onsite/page.tsx`

### Backend

- `src/app/api/reports/route.ts`
- `src/app/api/reports/[id]/route.ts` ← GET JOIN `line_users` คืน `line_user_id` / `line_is_friend` / `line_display_name`
- `src/app/api/reports/[id]/attachments/route.ts`
- `src/app/api/line/link/route.ts` ← รับ `is_friend` จาก client, parameterize upsert (2026-05)
- `src/app/api/line/link-via-url/route.ts`
- `src/app/api/line/webhook/route.ts`
- `src/lib/line-notification.ts` ← skip ถ้า `is_friend=false` + log `NOTIFICATION_FAILED` ทุก env (2026-05)

### Admin

- `src/app/admin/request/[id]/edit/_components/EditPageHeader.tsx` ← `LineLinkBadge` (2026-05)
- `src/app/admin/request/[id]/edit/_types.ts` ← เพิ่ม `line_user_id` / `line_is_friend` / `line_display_name` ใน `Report`

## 11. สถานะปัจจุบัน

สิ่งที่ทำเสร็จแล้ว:

- แยก onsite flow ออกจาก online flow
- คง flow เดิมไว้สำหรับหน้างานจริง
- สร้าง online flow ใหม่บน `/request`
- บังคับ LINE / LIFF gate ก่อนเข้าใช้งาน
- เพิ่มขั้นตอนเอกสาร 3 รายการใน step 2
- ให้ backend รับ `line_user_id` ตั้งแต่ตอนสร้างคำร้อง
- รองรับ selfie document type
- **(2026-05)** ปรับ onsite link flow เป็นแบบ link-first, friend-required-after — แก้ปัญหาผู้ยื่นต้องสแกน QR ซ้ำหลังเพิ่มเพื่อน
- **(2026-05)** API `/api/line/link` รับ `is_friend` จาก client + เลิก hardcoded `is_friend=true`
- **(2026-05)** notification flow skip ถ้า user ไม่ใช่เพื่อน + log `NOTIFICATION_FAILED` ทุก env รวม production
- **(2026-05)** เพิ่ม `LineLinkBadge` ในหน้า admin edit เตือนเรื่องสถานะ LINE link ก่อนอนุมัติ

สิ่งที่ยังทำเพิ่มได้ในอนาคต:

- ตั้ง LIFF "Add friend option = aggressive" ใน LINE Developers Console (เมื่อ LINE Login channel กับ Messaging API channel อยู่ provider เดียวกัน) เพื่อให้ user ใหม่เห็น "เพิ่มเพื่อน" ใน consent screen เลย — skip pending-friend step
- แยก success page ของ online ออกเป็น route เฉพาะ
- ทำ prefill profile จากฐานข้อมูลผู้ใช้ LINE
- เพิ่ม API `/api/user-profile?line_user_id=...`
- ทำ localized text ผ่าน messages/i18n ให้ครบทั้ง flow ใหม่
- ทำ retry / resume upload เอกสารในกรณีเน็ตหลุด
- handle webhook `unfollow` event เพื่อ sync `is_friend=false` กลับมาเมื่อ user ลบเพื่อน OA

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

