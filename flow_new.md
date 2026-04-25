ระบบยื่นคำร้องออนไลน์โดย flow การทำงานเป็นแบบนี้ ณ ปัจจุบัน คือ ผู้ยื่นกรอกข้อมูลยื่นคำร้องที่ลิ้งค์ https://cctvrequest.itac-huahincity.com/request เมื่อยื่นสำเร็จจะแสดงหน้า แสกน Qrcode หรือกดปุ่มเปิดไลน์เพื่อเพิ่มเพื่อนแล้วต้องการให้ผู้ยื่นพิมพม์สถานที่เข้ามาใน line oa เพื่อเชื่อมคำร้อง กับ user_id line เพื่อเวาลาเอกสารอนุมัติจะส่งวิดีโอภาพให้อัตโนมัติในช่องทาง Line oa แต่ปัญหาคือผู้ใช้ยื่นคำร้องจริงแต่ไม่แอดเพิ่มไลน์ ไม่ส่งข่อความเข้ามาในไลน์ ซึ่งการทำงานจะเดินต่อไม่ได้ มันมีทางแก้ไขลำดับ ยังไงได้บ้างเพื่อให้ ผู้ยื่นเข้าถึง line oa ได้จริงๆ ซึ่งฉันคิด flow นี้มา ะ "จบปัญหาผู้ใช้ไม่แอดไลน์" ได้ขาดล่วงที่สุด คือการใช้ LIFF (LINE Front-end Framework) เข้ามาครอบระบบเดิมครับ

🚀 FLOW FINAL (เวอร์ชันใช้งานจริง)
🎯 เป้าหมาย
ได้ line_user_id 100% ก่อน submit
ผู้ใช้ต้องเป็นเพื่อน LINE OA
ไม่ต้องให้ user พิมพ์อะไรใน LINE
ไม่มีงานค้าง (pending)
🟢 STEP 1: ผู้ใช้เข้าลิงก์เดิม
https://cctvrequest.itac-huahincity.com/request
🔒 Backend / Frontend ตรวจทันที:
if (!isFromLIFF) {
  redirect("https://liff.line.me/{LIFF_ID}");
}

👉 ไม่เปลี่ยนลิงก์
👉 แต่ “บังคับเข้า LIFF โดยอัตโนมัติ”

🟢 STEP 2: เข้า LINE Front-end Framework
2.1 Init + Login
await liff.init({ liffId: "xxx" });

if (!liff.isLoggedIn()) {
  liff.login();
}
2.2 ดึงข้อมูลผู้ใช้
const profile = await liff.getProfile();
const lineUserId = profile.userId;
2.3 เช็ค Add Friend
const friendship = await liff.getFriendship();
🔴 STEP 3: HARD GATE (จุดล็อกระบบ)
❌ ถ้ายังไม่ Add Friend

แสดงหน้าเดียว:

กรุณาเพิ่มเพื่อน LINE เพื่อใช้งานระบบ

[ ปุ่ม: เพิ่มเพื่อน ]

ลิงก์:

https://line.me/R/ti/p/@YOUR_OA_ID
🔒 Logic
if (!friendship.friendFlag) {
  blockEverything();
}

👉 ห้ามกรอก
👉 ห้าม submit
👉 ไม่มีทาง bypass

✅ ถ้า Add แล้ว
allowAccess();
🟢 STEP 4: โหลดฟอร์ม + Prefill (ถ้ามี)
GET /api/user-profile?line_user_id=Uxxxx

👉 auto กรอก:

ชื่อ
เบอร์
สถานที่เดิม
🟢 STEP 5: ผู้ใช้กรอก + กด Submit
Backend:
{
  request_id: 12345,
  line_user_id: "Uxxxx",
  status: "submitted"
}

👉 ไม่มี pending แล้ว
👉 mapping สำเร็จตั้งแต่แรก

🛟 STEP 6: SAFETY LAYER (กัน edge case)

หลัง submit:

redirect("https://liff.line.me/{LIFF_ID}/success?request_id=12345");
ในหน้า success (LIFF อีกครั้ง)
// เช็คซ้ำ
if (!liff.isLoggedIn()) login();
if (!friendship.friendFlag) block();

👉 กัน:

user หลุด session
user bypass somehow
🟢 STEP 7: แสดงผลสำเร็จ
✅ ยื่นคำร้องสำเร็จ
ระบบจะส่งผลให้คุณผ่าน LINE อัตโนมัติ
🟢 STEP 8: ฝั่ง Admin อนุมัติ
ยิง LINE Push
POST /v2/bot/message/push
{
  "to": "Uxxxx",
  "messages": [
    {
      "type": "video",
      "originalContentUrl": "...",
      "previewImageUrl": "..."
    }
  ]
}
🔥 FLOW พฤติกรรมผู้ใช้จริง
👤 ผู้ใช้ใหม่
เปิดลิงก์
login LINE
add friend
กรอก
submit
🔁 ผู้ใช้เก่า
เปิดลิงก์
เข้าฟอร์มทันที (skip ทุกอย่าง)
กรอก (หรือ prefill)
submit
🔒 ระบบป้องกันครบ
ปัญหา	วิธีแก้
ไม่ add LINE	Hard Gate
ไม่ login	auto login
ปิดหน้า	เกิดยากมาก (ยังไม่กรอกไม่ได้)
mapping ไม่ตรง	ใช้ user_id โดยตรง
user ไม่ทัก	ไม่ต้องทัก
❌ สิ่งที่ถูกตัดออกจากระบบ
QR Code ❌
ให้ user พิมพ์เอง ❌
manual mapping ❌
pending state ❌
🧠 Architecture สั้นๆ
User → /request
        ↓
   Redirect → LIFF
        ↓
Login + Check Friend
        ↓
Form (with line_user_id)
        ↓
Submit → DB (linked already)
        ↓
Admin approve → Push LINE
🎯 KPI ที่จะได้
🎯 Mapping สำเร็จ: ~100%
🎯 ผู้ใช้ไม่หลุด: ~95–99%
🎯 งานค้าง: ≈ 0
🎯 UX ดีขึ้นระยะยาว
💬 สรุปสุดท้าย (ฟันธง)

Flow นี้คือ:

“ล็อก user ตั้งแต่ก่อนเริ่ม + ไม่ให้มีทางเลือกผิด + ผูก LINE อัตโนมัติ”