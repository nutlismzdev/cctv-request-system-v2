# CODE REVIEW CHECKLIST — cctv-request-system-v2

ตรวจเมื่อ 2026-05-02 · ใช้เป็น single source of truth ระหว่างแก้ไข

---

## 🔴 CRITICAL — บล็อก production deploy

- [x] **#1 Auth พังทั้งระบบ** — `src/lib/auth.ts:45-66` รับรหัสผ่านอะไรก็ผ่าน, `src/lib/auth.ts:36-43` คืน admin เริ่มต้นเสมอ
  - [x] เพิ่ม `POST /api/admin/auth/login` ตรวจ `ADMIN_PASSWORD` ด้วย bcrypt
  - [x] ออก signed httpOnly cookie (`jose` JWT, HS256, 8h)
  - [x] เพิ่ม `requireAdmin()` helper ใน `src/lib/auth-server.ts`
  - [x] แก้ `middleware.ts` verify cookie ก่อนปล่อย `/admin/*` และ `/api/admin/*`
  - [x] แก้ `src/lib/auth.ts` ให้ login ฝั่ง client เรียก API จริง + ลบ fallback admin
  - [x] เพิ่ม `bcryptjs` + `jose` (+ `@types/bcryptjs`) ใน package.json
  - [x] เพิ่ม `/api/admin/auth/logout` และ `/api/admin/auth/me`
  - [x] อัปเดตหน้า admin pages 5 ไฟล์ + `admin-navbar` ให้ใช้ `checkAuth()` async
  - [x] **ตั้งค่าแล้วใน `.env` และ `.env.production`** (2026-05-02): `ADMIN_PASSWORD` = bcrypt hash ของ , `ADMIN_SESSION_SECRET` = 64-char base64 random
  - [ ] **ก่อน deploy production จริง:** regenerate ค่าทั้งสองอีกรอบ — secret ปัจจุบันโผล่ใน chat history แล้ว

- [x] **#2 No server-side auth on `/api/admin/*`** — middleware เป็น no-op
  - [x] **Decision:** middleware เป็น authoritative gate (เห็นทุก route ใต้ matcher) — ไม่ต้องใส่ `requireAdmin` รายไฟล์ ลด surface ของ bug "ลืมใส่"
  - [x] เพิ่ม `requireAdmin` ตัวอย่างใน `src/app/api/admin/requests/route.ts` เป็น defense-in-depth + reference pattern
  - [x] middleware ส่ง 401 JSON สำหรับ API, redirect `/login?next=…` สำหรับ page

- [x] **#3 Server-side upload validation**
  - [x] เพิ่ม `src/lib/file-validation.ts` — magic-byte sniffing (JPEG/PNG/GIF/WebP/HEIC/PDF/MP4/MOV/WebM/AVI), size cap, kind whitelist
  - [x] ใช้ใน `/api/reports/[id]/attachments` (image+pdf only)
  - [x] ใช้ใน `/api/reports/[id]/photos` (image+video only) + filename hygiene
  - [x] เพิ่ม `MAX_FILES_PER_REQUEST=20` กันยิง bulk DoS
  - [x] เพิ่ม Zod schema ใน `/api/admin/requests/[id]/cctv` POST — ตรวจ `file_path` regex (กัน path traversal), `mime_type`, `file_size`

---

## 🟠 HIGH

- [x] **#4 God component 1,868 บรรทัด** — `src/app/admin/request/[id]/edit/page.tsx` → **ลดเหลือ 121 บรรทัด** (2026-05-02)
  - [x] สกัด `useReportData` hook (fetch + save + validation) — `_hooks/useReportData.ts`
  - [x] สกัด `useServerFileBrowser`, `useDocsTab`, `usePhotosTab` hooks
  - [x] แตก `<ApplicantTab>` (รวม LocationPicker), `<OfficerTab>`, `<DocsTab>`, `<PhotosTab>` + `<UploadProgressBar>` + `<MediaCard>` + `<FullscreenMediaModal>` + `<EditPageHeader>` + `<EditTabsList>` + `<EditPageSkeleton>` เป็นไฟล์แยก
  - [x] ย้าย type definitions ไป `_types.ts` + utility functions ไป `_utils.ts`
  - [x] ใช้ `<ServerFileBrowser>` และ `<LocationPicker>` ที่ extract แล้วใน `src/components/`
  - [x] tsc --noEmit ผ่าน · eslint ผ่าน
  - [ ] **ยังเหลือ:** Manual QA โดย user (ทดสอบ 4 tabs + upload + map + PDF generate); Visual diff รายแท็บ; React Profiler วัด re-render
  - [ ] **ยังไม่ทำ:** เปลี่ยน useState รายฟิลด์ → `react-hook-form` (รอ checkpoint ถัดไป — refactor ปัจจุบันคง useState pattern เดิมเพื่อ zero behavior change)
  - 📄 **แผนต้นทาง:** `GOD_COMPONENT_REFACTOR_PLAN.md`

- [ ] **#5 .env บนเครื่อง production** — รหัสผ่าน DB + LINE token plaintext (ไม่ commit แต่อยู่บน disk)
  - [ ] ย้ายไป secret manager (Doppler / Vault / AWS SM) สำหรับ production
  - [x] ตั้ง `ADMIN_PASSWORD` (bcrypt hash) + `ADMIN_SESSION_SECRET` (64 chars) — 2026-05-02
  - [ ] หมุน LINE channel access token ครั้งสุดท้ายเมื่อไหร่ — บันทึก rotation policy
  - **ต้องการการตัดสินใจของผู้ใช้:** เลือก secret manager

---

## 🟡 MEDIUM

- [x] **#6 LINE token store ใน memory** — `src/lib/line-notification.ts`
  - [x] สร้างตาราง `line_tracking_tokens` (`database/line_tracking_tokens.sql`)
  - [x] แทน in-memory Map ด้วย DB calls (async)
  - [x] cleanup expired tokens ครั้งล่ะ ≤1 ครั้ง/ชม. (best-effort, non-blocking)
  - [x] อัปเดต `validateLineToken` เป็น async + แก้ consumer ใน `/api/status/result`
  - [x] **รัน migration แล้ว** (2026-05-02): MariaDB 11.8 บน 127.0.0.1:3306 — ตาราง `line_tracking_tokens` พร้อม 2 indexes (idx_line_tracking_expires, idx_line_tracking_report)

- [x] **#7 `getCurrentUser()` fallback เป็น admin เสมอ** — `src/lib/auth.ts:36-43`
  - [x] ลบ fallback ใน auth.ts ใหม่ — return `null` ถ้าไม่มี session

- [ ] **#8 ไม่มี migration tool** — `database/` เป็น `.sql` ดิบ
  - [ ] เลือก: `umzug` (raw SQL friendly), `node-pg-migrate` style สำหรับ MySQL, หรือ `drizzle-kit`
  - [ ] convert schema ปัจจุบันเป็น migration #001
  - [ ] เพิ่ม `npm run migrate` script
  - **ต้องการการตัดสินใจของผู้ใช้:** เลือกเครื่องมือ — drizzle ถ้ายอม rewrite query, umzug ถ้าอยากคง raw mysql2

---

## 🟢 LOW — clean-up

- [x] **#9** ลบ `console.log` ใน upload — `src/lib/use-upload.ts` (พร้อม import `humanSize` ที่ไม่ใช้)
- [x] **#10** เคลียร์ `eslint-disable react-hooks/exhaustive-deps` — `src/lib/use-upload.ts` (ใส่คอมเมนต์อธิบายเหตุผล intentional disable)
- [x] **#11** `tsconfig.json` มี `"strict": true` อยู่แล้ว — ตรวจสอบและยืนยัน
- [ ] **#12** เปลี่ยน XMLHttpRequest → `fetch` + `AbortController` ใน `use-upload.ts`
  - **เลื่อน:** XHR ยังจำเป็นสำหรับ true upload progress events (fetch streaming upload progress ยัง partial support)

---

## 💡 ENHANCEMENT — ทำหลัง critical/high เสร็จ (ต้องการการตัดสินใจ scope/priority)

- [ ] **A. Server-side image/video pipeline** — `sharp` thumbnail + `ffprobe` metadata + SHA-256 dedupe + EXIF location verify
- [ ] **B. PDPA & Audit-grade access control บนคลิป**
  - [ ] เปลี่ยน `/api/files/[...path]` เป็น signed URL (15 นาที, JWT)
  - [ ] ตาราง `file_access_logs (user_id, file_id, ip, accessed_at)`
  - [ ] watermark dynamic บนวิดีโอก่อนส่ง (ชื่อผู้ขอ + timestamp)
- [ ] **C. LINE LIFF UX**
  - [ ] Flex push ทุกครั้งที่สถานะเปลี่ยน
  - [ ] ส่ง video preview ตรงในแชตเมื่อคลิปพร้อม
  - [ ] quickReply: "ขอเพิ่มเติม / ปิดเรื่อง / ติดต่อเจ้าหน้าที่"
- [ ] **D. Heatmap predictive** — anomaly detection เทียบ 4-week baseline → แจ้ง LINE group
- [ ] **E. Officer auto-suggest** — by workload + เคยรับเรื่องในตำบลเดียวกัน + LINE online
- [ ] **F. FULLTEXT search** — index บน `incident_location`, `description` (หรือ Meilisearch สำหรับ typo-tolerant)
- [ ] **G. Observability** — Sentry + `/api/health` + slow query logging

---

## Progress log

| วันที่ | รายการ | สถานะ |
|---|---|---|
| 2026-05-02 | สร้าง checklist | ✅ |
| 2026-05-02 | #1 server-side auth (JWT cookie + login/logout/me APIs + middleware + client rewrite) | ✅ |
| 2026-05-02 | #2 covered by middleware (decision) + sample requireAdmin in /api/admin/requests | ✅ |
| 2026-05-02 | #3 magic-byte file validation + Zod schema for cctv metadata | ✅ |
| 2026-05-02 | #6 LINE token store moved to MySQL | ✅ |
| 2026-05-02 | #7 getCurrentUser fallback removed | ✅ |
| 2026-05-02 | #9 console.log cleanup | ✅ |
| 2026-05-02 | #10 eslint-disable documented | ✅ |
| 2026-05-02 | #11 strict TS confirmed already on | ✅ |
| 2026-05-02 | ตั้ง `ADMIN_PASSWORD` (bcrypt 77110) + `ADMIN_SESSION_SECRET` ใน `.env` และ `.env.production` | ✅ |
| 2026-05-02 | รัน migration `line_tracking_tokens.sql` บน cctv_huahin (MariaDB 11.8) | ✅ |
| 2026-05-02 | #4 God component refactor: 1868 บรรทัด → 121 บรรทัด (page.tsx) + 14 ไฟล์ย่อย, tsc/eslint ผ่าน | ✅ |

## Required actions before deploy

1. **ตั้ง env vars บน production:**
   ```bash
   # Generate bcrypt hash:
   node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
   # → paste into ADMIN_PASSWORD (or set plaintext — login route handles both)

   # Generate session secret:
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   # → paste into ADMIN_SESSION_SECRET (must be ≥32 chars)
   ```
2. **รัน migration:** `mysql -u<user> -p cctv_huahin < database/line_tracking_tokens.sql`
3. **Smoke test:** `/login` → ใส่รหัสผิด → ต้อง 401, ใส่ถูก → cookie set, redirect ไป admin, refresh ยังอยู่
4. **Smoke test API:** `curl -X GET https://host/api/admin/requests` (ไม่มี cookie) → 401
