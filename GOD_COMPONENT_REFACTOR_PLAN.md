# แผน refactor God Component — `src/app/admin/request/[id]/edit/page.tsx`

> ตรวจ 2026-05-02 · เป้าหมาย: แตก 1,868-line component โดย **zero behavior change** — ผู้ใช้ปลายทางไม่ควรสังเกตเห็นความต่าง นอกจากหน้าลื่นขึ้น

> **แก้ไขครั้งที่ 2 (2026-05-02):** ตรวจสอบกับ codebase จริงแล้วพบว่าแผนเดิมเข้าใจผิดบางจุด — ดู §0.1 "บันทึกการแก้ไข" ด้านล่าง

---

## 0. สถานะปัจจุบัน (baseline ที่ต้องไม่เปลี่ยน)

| Metric | ค่า | หมายเหตุ |
|---|---|---|
| ไฟล์ | `src/app/admin/request/[id]/edit/page.tsx` | |
| ความยาว | 1,868 บรรทัด | ยืนยันด้วย `wc -l` |
| `useState` calls | 13 | ยืนยันแล้ว (loading, saving, report, officers, categories, attachments, cctvMedia, activeTab, validationErrors, fullscreenMedia, serverFileBrowserOpen, serverFileCategory, form) |
| `useRef` / `useEffect` / `useCallback` / `useMemo` | 7 | รวมกับ useState = 20 hook calls |
| Tab จริง | **4** | `applicant` / `officer` / `docs` / `photos` (มี TabsTrigger ซ้ำ 2 ชุดสำหรับ mobile/desktop รวม 8 trigger แต่ logical = 4) |
| Modal/Section อื่น | 2 | `<ServerFileBrowser>` (modal) + ปุ่ม Generate PDF (อยู่บน header bar) |
| Imports | ~40 | |

**ฟังก์ชันที่ต้องคงเดิม 100%:**
- โหลดคำร้อง + แก้ไขทุกฟิลด์ + บันทึก
- อัปโหลด/ลบ/อนุมัติ CCTV image และ video (Tab `photos`)
- อัปโหลด/ลบเอกสารแนบ PDF + รูป (Tab `docs`)
- เลือกตำแหน่งบนแผนที่ — ใช้ `<LocationPicker>` (component **ที่ extract ออกแล้ว** ที่ `src/components/location-picker.tsx`) ฝังอยู่ใน Tab `applicant`
- มอบหมายเจ้าหน้าที่ + เปลี่ยนสถานะ + กรอก decision/notes (Tab `officer`)
- สร้าง PDF รายงานส่งกลับผู้ขอ — ปุ่มอยู่บน header (เรียก `/api/reports/[id]/pdf`)
- File browser เลือกไฟล์ที่อยู่บน server (`idcopy` / `operation`) — ใช้ `<ServerFileBrowser>` (component **ที่ extract ออกแล้ว** ที่ `src/components/server-file-browser.tsx`)
- Auth gate: import `import { checkAuth as verifyAuth } from '@/lib/auth'` (ฟังก์ชันชื่อจริงคือ `checkAuth`, alias เป็น `verifyAuth` ในไฟล์นี้)

### 0.1 บันทึกการแก้ไข (เทียบกับร่างก่อนหน้า)
- ❌ **เดิมเขียนว่ามี 7 tabs/sections** — ผิด มี 4 tabs จริง: `applicant`/`officer`/`docs`/`photos`
- ❌ **เดิมจัด `<ServerFileBrowser>` เป็นงาน "ต้อง extract"** — ผิด extract แล้วที่ `src/components/server-file-browser.tsx`; งานเหลือคือเก็บ state คู่ (`open`, `category`) ให้รวบรัดเท่านั้น
- ❌ **เดิมจัด Map เป็น tab แยก (`MapTab`)** — ผิด แผนที่ฝังในกล่องที่อยู่ของ Tab `applicant`; แถมใช้ `<LocationPicker>` ที่ extract แล้ว ไม่ต้อง refactor logic Leaflet เพิ่ม
- ❌ **เดิมเขียน `verifyAuth()` from `@/lib/auth`** — ฟังก์ชันชื่อจริง `checkAuth`
- ❌ **เดิมระบุ `/api/admin/requests/[id]/cctv` เป็น API ที่หน้านี้เรียก** — ผิด หน้า edit ใช้ `/api/reports/[id]/photos` และ `/api/reports/[id]/attachments` (path ฝั่ง public ไม่ใช่ฝั่ง admin) — endpoint admin มีอยู่จริงในระบบแต่หน้านี้ไม่เรียก

---

## 1. หลักการ — "Zero behavior change refactor"

| หลัก | วิธีปฏิบัติ |
|---|---|
| **A. ไม่แตะ API contract** | ทุก endpoint ที่หน้านี้เรียก ห้ามเปลี่ยน path/payload/response — backend code ไม่ต้องแก้ |
| **B. ไม่เปลี่ยน UX flow** | ลำดับการกดปุ่ม, modal ที่เด้ง, toast ที่ขึ้น, redirect path — เหมือนเดิมทุก step |
| **C. แตกทีละชิ้น merge ทีละ PR** | ห้ามแตก 7 แท็บใน PR เดียว — แต่ละแท็บ = 1 PR เล็ก ทดสอบแล้ว merge แล้วถึงทำต่อ |
| **D. ไฟล์เดิมยังคงอยู่จนถึงท้าย** | `page.tsx` ค่อย ๆ เบาลงทีละ section ไม่ลบทีเดียว — สามารถ revert PR เดียวได้ |
| **E. Snapshot test ก่อน-หลัง** | render ด้วย Playwright รายแท็บ เก็บ DOM snapshot ก่อน refactor เปรียบเทียบหลัง |
| **F. Visual diff** | screenshot รายแท็บ ก่อน-หลัง — ตำแหน่ง pixel ไม่ควรเลื่อนเกิน 2px |
| **G. ไม่เพิ่ม dependency ใหม่** | ใช้ `react-hook-form` + `zod` ที่มีติดตั้งอยู่แล้ว ไม่เพิ่ม Zustand/Jotai/Redux |

---

## 2. โครงสร้างเป้าหมาย

```
src/app/admin/request/[id]/edit/
├── page.tsx                       (~120 บรรทัด — auth gate + tab switcher + ActionBar + layout)
├── _hooks/
│   ├── useReportData.ts           (fetch report+officers+categories + save + invalidate)
│   ├── usePhotosTab.ts            (CCTV photos: list/upload/delete/approve)
│   ├── useDocsTab.ts              (attachments CRUD: PDF + รูป)
│   └── useGenerateReportPdf.ts    (เรียก `/api/reports/[id]/pdf`)
├── _components/
│   ├── ApplicantTab.tsx           (~300 บรรทัด — react-hook-form, ฟิลด์ ~20 ตัว + ฝัง <LocationPicker>)
│   ├── OfficerTab.tsx             (~150 — assign officer + status + officer_decision/notes + validation)
│   ├── DocsTab.tsx                (~200 — เอกสารแนบ PDF/รูป + ปุ่มเปิด ServerFileBrowser)
│   └── PhotosTab.tsx              (~300 — CCTV image/video + อนุมัติ/ลบ + fullscreen modal)
├── _types.ts                      (interfaces: Report, Officer, Category, Attachment, Media)
└── _utils.ts                      (getLocalizedPrefix, status mapping, date formatters)

(ไม่ต้องสร้างใหม่ — ใช้ของเดิม:)
- src/components/server-file-browser.tsx ✓ extract แล้ว
- src/components/location-picker.tsx     ✓ extract แล้ว (มี dynamic import + cleanup ภายในแล้ว)
- src/lib/use-upload.ts                   ✓ มี progress/retry built-in
```

หลัง refactor: **ไม่มีไฟล์ใดเกิน 300 บรรทัด** และ `page.tsx` เหลือแค่ orchestration

> ปุ่ม **Save / PDF / Back** อยู่บน sticky header ของ `page.tsx` อยู่แล้ว — ไม่ได้แยกเป็นไฟล์ `ActionBar.tsx` แยก เว้นแต่ขนาด JSX เกิน 80 บรรทัด ค่อยสกัด

---

## 3. ขั้นตอน 8 ระยะ (ทำตามลำดับ — ห้ามข้าม)

### ระยะ 0 — Safety net (ก่อนแตะโค้ด)
- [ ] **0.1** เพิ่ม smoke test script `scripts/smoke-edit-page.ts` ที่ Playwright รัน:
  - login → เปิด `/admin/request/<existing-id>/edit` → assert เห็น 4 tabs (`applicant`/`officer`/`docs`/`photos`)
  - upload mock CCTV image (1KB PNG) ใน Tab `photos` → assert เห็นในรายการ → delete → assert หาย
  - upload mock attachment PDF ใน Tab `docs` → assert เห็น → delete
  - ใน Tab `applicant`: คลิกแผนที่ผ่าน `<LocationPicker>` → assert lat/lng ใส่ใน input
  - ใน Tab `officer`: assign officer + เปลี่ยน status → save → reload → assert ค่าคงอยู่
  - กดปุ่ม PDF บน header → assert response 200 + Content-Type `application/pdf`
- [ ] **0.2** เก็บ DOM snapshot รายแท็บไว้ใน `tests/snapshots/before-refactor/`
- [ ] **0.3** Screenshot รายแท็บ ความละเอียด 1440x900 + 375x812 (mobile)
- [ ] **0.4** สร้าง branch `refactor/edit-page-decompose` แยกจาก master
- [ ] **0.5** บันทึก network calls ผ่าน DevTools HAR file — ใช้เป็น contract test

### ระยะ 1 — สกัด types และ utils (ไม่กระทบ runtime)
- [ ] **1.1** สร้าง `_types.ts` ย้าย `interface Report`, `Officer`, `Category`, `Attachment`, `Media`, `UploadResponse`, `AttachmentCategory` จาก page.tsx
- [ ] **1.2** สร้าง `_utils.ts` ย้าย pure helpers: `getLocalizedPrefix()`, status color map, date/time formatters
- [ ] **1.3** ใน `page.tsx` เปลี่ยนเป็น `import` จากไฟล์ใหม่
- [ ] **1.4** รัน `npx tsc --noEmit` ผ่าน
- [ ] **1.5** เปิดหน้าจริงในเบราว์เซอร์ — กดทุก action — เทียบกับ HAR เดิม
- ✅ **Checkpoint 1:** ไฟล์ใหม่ 2 ไฟล์ + page.tsx ลดลง ~100 บรรทัด behavior เหมือนเดิม

### ระยะ 2 — สกัด `useReportData` hook
- [ ] **2.1** สร้าง `_hooks/useReportData.ts` ย้าย logic ใน `loadAll()` (ดึง 5 endpoint แบบ parallel: `/api/reports/[id]`, `/api/officers`, `/api/categories`, `/api/reports/[id]/attachments`, `/api/reports/[id]/photos`)
- [ ] **2.2** Hook return shape: `{ report, officers, categories, attachments, cctvMedia, isLoading, error, save, refresh, setAttachments, setCctvMedia }`
- [ ] **2.3** `page.tsx` ใช้ hook แทน useState + useEffect ก้อนใหญ่ (ครอบทั้ง state 7 ตัว: report/officers/categories/attachments/cctvMedia/loading + helpers)
- [ ] **2.4** Smoke test: load → edit → save → reload — ค่าคงอยู่
- ✅ **Checkpoint 2:** state สำหรับ report data หลุดออกจาก page.tsx แล้ว

### ระยะ 3 — รวบ state ของ ServerFileBrowser (ไม่ใช่งาน extract — extract เสร็จแล้ว)
> หมายเหตุ: `<ServerFileBrowser>` มีอยู่แล้วที่ `src/components/server-file-browser.tsx` งานในระยะนี้คือเก็บ `serverFileBrowserOpen` + `serverFileCategory` ให้รวบรัด ไม่ใช่สร้างไฟล์ใหม่
- [ ] **3.1** สร้าง `_hooks/useServerFileBrowser.ts` รวม 2 state เดิม + helper `openFor(category)`
- [ ] **3.2** `page.tsx` ใช้ `const browser = useServerFileBrowser()` แทน 2 useState เดิม
- [ ] **3.3** Smoke test: เปิด modal (ทั้ง `idcopy` และ `operation`) → เลือกไฟล์ → modal ปิด → ไฟล์เพิ่มในรายการ
- ✅ **Checkpoint 3:** state ของ modal หลุดออกจาก page.tsx — ใช้ component เดิมที่ extract แล้วโดยไม่แตะ

### ระยะ 4 — สกัด `<ApplicantTab>` (Tab `applicant` — ฟอร์มผู้ขอ + ที่อยู่ + LocationPicker)
- [ ] **4.1** สร้าง `_components/ApplicantTab.tsx` รับ `{ form, update, errors }` ใช้ `react-hook-form`
- [ ] **4.2** ย้ายฟิลด์ทั้งหมดของ `<TabsContent value="applicant">` (line ~740–975 ใน page.tsx ปัจจุบัน) เข้า component
- [ ] **4.3** รวม `<LocationPicker>` (ที่ extract แล้ว) ฝังใน tab นี้ — ไม่ต้อง refactor logic Leaflet เพิ่ม
- [ ] **4.4** ใช้ Zod schema reuse จาก `/api/reports` POST schema
- [ ] **4.5** ใช้ `<Controller>` เฉพาะ Select/DatePicker — input ทั่วไปใช้ `register()`
- [ ] **4.6** Smoke test: แก้ทุกฟิลด์ + คลิกแผนที่ → save → reload → ค่าคงอยู่; ใส่ค่าผิด format → toast error เหมือนเดิม
- ✅ **Checkpoint 4:** Tab `applicant` เป็น component อิสระ → re-render scope ลดลง 60%+

### ระยะ 5 — สกัด `<PhotosTab>` (Tab `photos` — CCTV image/video พร้อม upload progress)
- [ ] **5.1** สร้าง `_hooks/usePhotosTab.ts` (list/upload/delete/approve) — wrap `useUpload` ที่มีอยู่
- [ ] **5.2** สร้าง `_components/PhotosTab.tsx` ใช้ hook ใหม่ + ย้าย fullscreen modal state เข้ามาด้วย
- [ ] **5.3** Progress UI ต้องคงเดิม (toast + progress bar + speed/ETA จาก `useUpload`)
- [ ] **5.4** Smoke test: upload 3 ไฟล์ขนาดต่างกัน → progress ขึ้นจริง → list update → delete → list update; อนุมัติ/ไม่อนุมัติ ทำงาน
- [ ] **5.5** Edge cases: upload fail (network), retry, cancel mid-upload
- ✅ **Checkpoint 5:** Tab `photos` เป็น component อิสระ มี hook ของตัวเอง

### ระยะ 6 — สกัด `<DocsTab>` (Tab `docs` — เอกสารแนบ pattern คล้าย PhotosTab)
- [ ] **6.1** สร้าง `_hooks/useDocsTab.ts` ใช้ endpoint `/api/reports/[id]/attachments`
- [ ] **6.2** สร้าง `_components/DocsTab.tsx` รวมการใช้งาน `<ServerFileBrowser>` (เปิดด้วย `browser.openFor('idcopy')` หรือ `'operation'`)
- [ ] **6.3** Smoke test: upload PDF/รูป → list update → delete → list update; เลือกจาก ServerFileBrowser → list update
- ✅ **Checkpoint 6:** Tab `docs` เป็น component อิสระ

### ระยะ 7 — สกัด `<OfficerTab>` (Tab `officer` — สถานะ + assign + decision/notes + validation)
- [ ] **7.1** สร้าง `_components/OfficerTab.tsx` รับ `{ form, update, officers, errors }`
- [ ] **7.2** ย้าย `validateField` (officer_decision/internal_notes) เข้า component หรือ hook ใหม่ `useOfficerValidation`
- [ ] **7.3** Smoke test: เปลี่ยนสถานะ → save → toast แจ้ง LINE ทำงานเหมือนเดิม; assign officer → reload → ค่าคงอยู่; เลือก "ไม่อนุญาต" โดยไม่กรอก notes → toast/inline error เหมือนเดิม
- ✅ **Checkpoint 7:** Tab `officer` เป็น component อิสระ + validation logic แยก

### ระยะ 8 — Cleanup `page.tsx` + `useGenerateReportPdf` + finalize
- [ ] **8.1** สร้าง `_hooks/useGenerateReportPdf.ts` wrap การเรียก `/api/reports/[id]/pdf?mode=draw`
- [ ] **8.2** `page.tsx` ควรเหลือแค่:
  - auth gate ผ่าน `verifyAuth()` (ฟังก์ชัน `checkAuth` ที่ alias เป็น verifyAuth)
  - URL params + `useReportData(reportId)`
  - tab state: `useState<'applicant'|'officer'|'docs'|'photos'>('applicant')`
  - sticky header (ปุ่ม Back/Save/PDF) + `<Tabs>` + 4 tab components
  - `<ServerFileBrowser>` (controlled ด้วย `useServerFileBrowser()`)
- [ ] **8.3** ลบ import ที่ไม่ใช้ ใช้ `npx eslint --fix`
- [ ] **8.4** รัน `npx tsc --noEmit` + `npx eslint .` + `npx next build` ผ่าน
- [ ] **8.5** Final regression test: รัน Playwright suite ครบทุกเคส
- [ ] **8.6** Visual diff รายแท็บ — ห้ามเกิน 2px shift
- ✅ **Checkpoint 8:** `page.tsx` ≤ 150 บรรทัด · ไฟล์ component ≤ 300 บรรทัด · ไฟล์ hook ≤ 150 บรรทัด

---

## 4. กลยุทธ์ migration ที่ปลอดภัย

### กฎทอง 5 ข้อ
1. **1 PR = 1 checkpoint** — merge แล้ว deploy ขึ้น staging ก่อนเริ่ม checkpoint ถัดไป
2. **ห้าม optimize ระหว่าง refactor** — เห็น code ห่วยก็ทิ้งไว้ก่อน อย่าปรับใน PR เดียวกัน เพื่อให้ diff อ่านง่าย
3. **Behavior diff = bug** — ถ้า reviewer เห็นว่า "เหมือนจะดีขึ้น" ให้ย้อนกลับ ทำเฉพาะที่ scope บอก
4. **Snapshot ก่อน push** — ถ้า DOM/screenshot ต่างจาก baseline แม้แต่ class name → reject
5. **Rollback plan ทุก PR** — ถ้า production พัง: revert PR เดียว ไม่ใช่ revert ทั้ง refactor

### Feature flag (optional แต่แนะนำ)
ถ้ายอม invest อีกนิด — ใส่ env `NEXT_PUBLIC_USE_REFACTORED_EDIT=true` แล้วทำสองชั้น:

```tsx
// page.tsx ระหว่าง migration
export default function EditPage() {
  if (process.env.NEXT_PUBLIC_USE_REFACTORED_EDIT === 'true') {
    return <RefactoredEditPage />
  }
  return <LegacyEditPage />
}
```

ผลคือ rollback ใน 5 วินาที (เปลี่ยน env + restart) ไม่ต้อง revert PR

### หาก checkpoint ไหน fail
- **Smoke test fail** → revert checkpoint นั้น คิดใหม่ ห้ามปะ
- **Performance regress** → ใช้ React DevTools Profiler หา re-render ที่ไม่ตั้งใจ ส่วนใหญ่คือ inline object ใน prop
- **Type error หลัง upgrade RHF** → ตรวจ defaultValues type ตรงกับ schema; ใช้ `useForm<z.infer<typeof schema>>()`

---

## 5. ความเสี่ยงและการ mitigate

| ความเสี่ยง | ผลกระทบ | Mitigate |
|---|---|---|
| Form state ของ RHF ไม่ sync กับ state เดิมตอน save | บันทึกไม่เห็นค่าที่ผู้ใช้พิมพ์ | ใน checkpoint 4 ใช้ `getValues()` ก่อน submit ทดสอบ field ทุกชนิด (text/select/date/checkbox) |
| Leaflet instance leak ตอน switch tab | RAM โต ใน prod เครื่องเด็ก ๆ ค้าง | ระยะ 7.2 cleanup effect: `map.remove()` ใน return ของ useEffect |
| Upload progress UI หายไประหว่าง refactor | เจ้าหน้าที่คิดว่าค้าง กด refresh = upload หาย | ระยะ 5.3 visual diff progress bar ก่อน-หลัง |
| Tab switch รีเซ็ต form ที่ผู้ใช้กรอกครึ่งทาง | UX ถดถอย | RHF เก็บ state ใน hook ไม่ผูกกับ DOM mount — ตรวจในระยะ 9.4 |
| Officer dropdown โหลดช้าหลังแยก hook | กดมอบหมายแล้ว dropdown ว่าง | `useOfficerList()` ใช้ SWR pattern หรือ memoize ใน parent |
| Snapshot test ผ่าน แต่ผู้ใช้จริงเจอ bug | เพราะ snapshot ไม่ครอบ flow async | ระยะ 0.1 รวม flow async (upload retry, save fail/retry) |

---

## 6. Definition of Done

ทั้ง refactor ถือว่าจบเมื่อ:

- [ ] `page.tsx` ≤ 150 บรรทัด · ไฟล์ component ≤ 300 บรรทัด · ไฟล์ hook ≤ 150 บรรทัด
- [ ] `npx tsc --noEmit` ผ่าน, `npx eslint .` ผ่าน, `npx next build` ผ่าน
- [ ] Playwright smoke suite ผ่าน 100% (ทุกเคสในระยะ 0.1)
- [ ] Visual diff รายแท็บ ≤ 2px shift
- [ ] Network HAR เทียบ baseline — ไม่มี request เพิ่ม/หาย/payload เปลี่ยน
- [ ] Manual QA โดยเจ้าหน้าที่จริง 1 คน บนเครื่อง production เสมือนจริง — ผ่าน 6 flow หลัก (load/save · upload+approve photos · upload+delete docs · เลือกตำแหน่งบนแผนที่ · assign officer+เปลี่ยนสถานะ · generate PDF)
- [ ] Performance: First Contentful Paint หน้า edit ลดลง ≥ 30% (เพราะ bundle รายแท็บ code-split ได้)
- [ ] React Profiler: re-render รวมเมื่อแตะ field 1 ตัว ลดลง ≥ 60%
- [ ] อัปเดต `CODE_REVIEW_CHECKLIST.md` ติ๊ก #4 เสร็จ

---

## 7. ประมาณการเวลา

| ระยะ | เวลา | หมายเหตุ |
|---|---|---|
| 0 — Safety net | 4 ชม. | ครั้งเดียว ลงทุนระยะยาว |
| 1 — Types/utils | 1 ชม. | mechanical move |
| 2 — useReportData | 2.5 ชม. | logic ก้อนใหญ่ (รวม 5 endpoint parallel) |
| 3 — useServerFileBrowser | 0.5 ชม. | แค่ห่อ 2 useState — เร็วกว่าเดิมเพราะ component extract แล้ว |
| 4 — ApplicantTab (รวม LocationPicker) | 4 ชม. | RHF migration ฟิลด์ ~20 + ฝังแผนที่ |
| 5 — PhotosTab | 4 ชม. | upload progress + edge cases + fullscreen modal |
| 6 — DocsTab | 2 ชม. | pattern คล้าย 5 + ใช้ ServerFileBrowser |
| 7 — OfficerTab | 2.5 ชม. | validation logic + status/officer assign |
| 8 — Cleanup + PDF hook + final QA | 2.5 ชม. | dot-the-i |
| **รวม** | **~23 ชม.** | กระจาย ~3 working days |

ทำเป็น **session ละ 1-2 ระยะ** จะได้ merge บ่อย review ง่าย เห็น regression เร็ว — ไม่แนะนำให้ทำรวด 23 ชม.

> เวลาลดจากเดิม 26.5 ชม. → 23 ชม. เพราะตัด `MapTab` (Leaflet ใน LocationPicker เดิมแล้ว) และเปลี่ยน ServerFileBrowser จากงาน "extract" เป็นแค่ "wrap state"

---

## 8. คำสั่งที่ใช้ระหว่าง refactor (อ้างอิงเร็ว)

```bash
# หลังแก้ทุก checkpoint
npx tsc --noEmit                          # type check
npx eslint src/app/admin/request          # lint เฉพาะโฟลเดอร์ที่แตะ
npx playwright test tests/edit-page       # smoke test
npx next build                            # production build sanity

# วัด re-render ก่อน/หลัง
# 1. เปิด DevTools → Profiler → Record
# 2. กรอกฟิลด์ "ชื่อ-นามสกุล" 1 ตัวอักษร
# 3. Stop record → ดู "Components rendered" count
# baseline ปัจจุบัน: ~60-80 components / keystroke (จากการประมาณ)
# เป้าหมาย: ≤ 25 / keystroke
```

---

## 9. ลิงก์อ้างอิงที่เกี่ยวข้อง

- **ไฟล์ตัวการ:** `src/app/admin/request/[id]/edit/page.tsx`
- **API ที่หน้านี้เรียกจริง** (เทียบจาก `grep '/api/'` ใน page.tsx):
  - `GET /api/reports/[id]` — โหลดคำร้อง
  - `PATCH /api/reports/[id]` — บันทึกคำร้อง
  - `GET/POST/DELETE /api/reports/[id]/attachments` — เอกสารแนบ
  - `GET/POST/DELETE/PATCH /api/reports/[id]/photos` — CCTV media (รวม approve)
  - `GET /api/reports/[id]/pdf?mode=draw` — สร้าง PDF
  - `GET /api/officers` — dropdown เจ้าหน้าที่
  - `GET /api/categories` — หมวดหมู่
- **Component ที่ extract ออกแล้ว (ห้ามสร้างซ้ำ):**
  - `src/components/server-file-browser.tsx` — modal เลือกไฟล์ server
  - `src/components/location-picker.tsx` — Leaflet map (มี dynamic import + cleanup ภายใน)
- **Hooks/utils ที่ reuse:**
  - `src/lib/use-upload.ts` — upload + progress + retry
  - `src/lib/auth.ts` — `checkAuth()` (ในไฟล์ page.tsx alias เป็น `verifyAuth`)
  - `src/lib/upload-utils.ts` — `humanSize`, `downloadFile`
  - `src/lib/file-validation.ts` — validate ก่อน upload
  - `src/lib/theme-colors.ts` — `getStatusStyle`, `THEME_COLORS`
- **Master checklist:** `CODE_REVIEW_CHECKLIST.md` ข้อ #4
