# LINE Messaging API Integration Setup

## ภาพรวม (Flow ปุ่มเดียว)
ระบบ LINE Integration สำหรับระบบจัดการคำร้องขอดูภาพ CCTV เทศบาลนครหัวหิน

## คุณสมบัติที่เพิ่มเข้ามา
- ✅ **ปุ่มเดียว** เชื่อมต่อ LINE OA + ผูกคำร้องอัตโนมัติ
- ✅ **เพิ่มเพื่อน OA** อัตโนมัติผ่าน Bot Link
- ✅ **ผูกคำร้องกับ LINE User** อย่างปลอดภัย
- ✅ **ส่งแจ้งเตือน** เมื่ออนุมัติเอกสารพร้อมลิงก์ดาวน์โหลด
- ✅ **LINE LIFF** สำหรับการจัดการทั้งหมด
- ✅ **Webhook** สำหรับจัดการข้อความ LINE

## การติดตั้ง (ขั้นตอนที่ 0-3)

### 0. สิ่งที่ต้องมีก่อนเริ่ม
- ✅ **LINE Official Account** ที่ผูกกับ Messaging API
- ✅ **Provider: Hua Hin CCTV**
- ✅ **Messaging API Channel** ที่เปิดใช้งานแล้ว

### 1. ตั้งค่าฐานข้อมูล
รัน SQL script นี้ในฐานข้อมูล MySQL ของคุณ:

```sql
-- ไฟล์: database/line_integration.sql
-- รวมถึง:
-- - สร้างตาราง line_users
-- - เพิ่มคอลัมน์ line_user_id และ tracking_token ในตาราง reports
-- - สร้าง trigger และ index ที่จำเป็น
```

### 2. สร้าง LINE Login Channel
1. เข้า [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Channel ใหม่ประเภท **LINE Login**
3. ใน LIFF Settings → เพิ่ม LIFF App:
   - **Name**: CCTV Request Link
   - **Endpoint URL**: `https://your-domain.com/liff/link`
   - **Scopes**: `openid`, `profile`
   - **Bot link**: เลือก OA Channel ที่มีอยู่
   - **Bot Prompt**: `aggressive` (แสดงปุ่มเพิ่มเพื่อนอัตโนมัติ)
4. คัดลอก **LIFF ID** มาเก็บไว้

### 3. ตั้งค่า Webhook สำหรับ OA
1. กลับไปที่ **Messaging API Channel** ที่มีอยู่แล้ว
2. ใน Messaging API Settings:
   - **Webhook URL**: `https://your-domain.com/api/line/webhook`
   - **Webhook**: `Enabled`
   - **Auto-reply**: `Disabled`
   - **Greeting**: `Disabled`
3. กด **Verify** ให้ผ่าน

### 4. ตั้งค่า LINE Group สำหรับแจ้งเตือนเจ้าหน้าที่
สำหรับการส่งแจ้งเตือนไปยังกลุ่ม LINE ของเจ้าหน้าที่เมื่อมีคำร้องใหม่:

1. **สร้าง LINE Official Account ใหม่** หรือใช้ Channel ที่มีอยู่สำหรับส่งแจ้งเตือนกลุ่ม
2. **สร้างกลุ่ม LINE** และเชิญ Bot เข้าไปในกลุ่ม
3. **นำ Bot เข้าสู่กลุ่ม** ผ่าน QR Code หรือลิงก์เชิญ
4. **คัดลอก Group ID** จาก Webhook events หรือ LINE Developer Console
5. **คัดลอก Channel Access Token** จาก Messaging API Channel

### 5. ตั้งค่า Environment Variables
เพิ่มตัวแปรเหล่านี้ในไฟล์ `.env`:

```env
# LINE Messaging API (OA) - จาก Channel ที่มีอยู่
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# LIFF Configuration (Login Channel) - จากขั้นตอนที่ 2
# LIFF app สำหรับ /request (online flow)
NEXT_PUBLIC_LINE_LIFF_ID=your_liff_id_for_request
# LIFF app สำหรับ /liff-onsite/dispatch (onsite QR auto-link)
NEXT_PUBLIC_LINE_LIFF_ONSITE_ID=your_liff_id_for_onsite_dispatch

# LINE Group Notification (สำหรับส่งแจ้งเตือนไปยังกลุ่มเจ้าหน้าที่)
LINE_GROUP_ACCESS_TOKEN=your_group_access_token
LINE_GROUP_ID=your_group_id

# Base URL for notifications
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

> **Note**: `NEXT_PUBLIC_LIFF_ID` (ไม่มี `_LINE_`) เป็นชื่อเก่าที่ยังรองรับเป็น fallback แต่แนะนำใช้ `NEXT_PUBLIC_LINE_LIFF_ID` + `NEXT_PUBLIC_LINE_LIFF_ONSITE_ID` ในระบบใหม่

### 6. ตั้งค่า QR Code (ไม่บังคับ)
อัปเดตไฟล์ `public/qrcode/M_513dlddc_BW.png` เป็น QR Code ของ LINE OA ของคุณ

## Flow การทำงาน (ปุ่มเดียว)

### ผู้ยื่นคำขอ
1. **ยื่นคำร้อง** → ระบบสร้าง `tracking_token` และ redirect ไป success page
2. **กด "เชื่อมต่อกับ LINE OA"** → เปิดหน้า LIFF (`/liff/link`)
3. **หน้า LIFF จัดการอัตโนมัติ**:
   - ถ้ายังไม่ login → `liff.login()`
   - ถ้ายังไม่เป็นเพื่อน OA → เปิดหน้าเพิ่มเพื่อนอัตโนมัติ
   - เมื่อเป็นเพื่อนแล้ว → ดึง `userId` และผูกกับคำร้อง
4. **แสดงผลสำเร็จ** → "เชื่อมสำเร็จ ✅ จะมีการแจ้งเมื่ออนุมัติ"

### เจ้าหน้าที่รับแจ้งเตือน
1. **เมื่อมีคำร้องใหม่** → ระบบส่งแจ้งเตือนไปยังกลุ่ม LINE ของเจ้าหน้าที่
2. **เจ้าหน้าที่ตรวจสอบ** คำร้องผ่านลิงก์ในข้อความ
3. **อนุมัติเอกสาร** → เปลี่ยนสถานะเป็น "เอกสารอนุมัติเรียบร้อย"
4. **ระบบตรวจสอบ** `line_user_id` ในตาราง reports
5. **ส่ง LINE notification** ไปยังผู้ใช้ที่ผูก LINE พร้อมลิงก์ดาวน์โหลด PDF

## API Endpoints

### `/api/line/link`
- **Method**: POST
- **Body**: `{ report_id, tracking_token, userId, is_friend? }`
- **Description**: ผูก LINE user กับคำร้อง
- **Note (2026-05)**: รับ optional `is_friend: boolean` จาก client (ค่าจาก `liff.getFriendship().friendFlag`) เพื่อเก็บสถานะเพื่อนตามจริงใน `line_users.is_friend` ถ้าไม่ส่งจะ default เป็น `false` — webhook follow event จะ sync ค่าใหม่ภายหลังเมื่อผู้ใช้กดเพิ่มเพื่อน

### `/api/line/link`
- **Method**: GET
- **Query**: `?report_id=123&tracking_token=abc`
- **Description**: ตรวจสอบสถานะการผูก

### `/api/line/webhook`
- **Method**: POST
- **Description**: Webhook สำหรับรับข้อความจาก LINE
- **Note**: ทุก event ที่มี `userId` จะ upsert `line_users.is_friend = true` (LINE จะส่ง event ก็ต่อเมื่อ user เป็นเพื่อนแล้ว) ทำให้ DB sync friendship อัตโนมัติเมื่อ user เพิ่มเพื่อนภายหลังการ link

**Note**: เมื่อสร้างคำร้องใหม่ ระบบจะส่ง LINE notification ไปยังกลุ่มโดยอัตโนมัติผ่านฟังก์ชัน `sendGroupNotificationForNewReport`

## Notification Behavior (2026-05)

`src/lib/line-notification.ts` `sendLineNotification()` — เพิ่ม guard ก่อนยิง LINE API:

1. ดึง `is_friend` จาก `line_users` ก่อนยิง push
2. ถ้า `is_friend = false` → **ไม่ยิง API** เพราะ LINE Messaging API ไม่อนุญาตให้ส่งให้ user ที่ไม่ได้เป็นเพื่อน
   - Log: `NOTIFICATION_SKIPPED_NOT_FRIEND` ใน `activity_logs`
   - Return: `{ skipped: true, reason: 'not_friend' }` (ไม่ throw)
3. ถ้ายิงแล้ว LINE API คืน error → log `NOTIFICATION_FAILED` ใน `activity_logs` พร้อม error message ใน metadata (log ทุก env รวม production — ก่อน 2026-05 log เฉพาะ dev)

### Activity Log Actions ที่เกี่ยวข้อง

| Action | ความหมาย | env |
|---|---|---|
| `NOTIFICATION_SENT` | ส่ง push สำเร็จ | dev only |
| `NOTIFICATION_SKIPPED_NOT_FRIEND` | ผู้ยื่นยังไม่เพิ่มเพื่อน — skip ไม่ยิง API | ทุก env |
| `NOTIFICATION_FAILED` | ยิงไปแล้ว LINE API error | ทุก env |

## Admin LINE Link Badge (2026-05)

หน้า `/admin/request/[id]/edit` แสดง badge สถานะ LINE link ของผู้ยื่นใน `EditPageHeader`:

- 🟢 **เขียว** "ผูกแล้ว — เป็นเพื่อน" (พร้อมส่ง noti)
- 🟡 **เหลือง** "ผู้ยื่นยังไม่ได้เพิ่มเพื่อน LINE OA — ส่งลิงก์วิดีโออัตโนมัติไม่ได้" (ต้อง follow-up ก่อนอนุมัติ)
- ⚪ **เทา** "ยังไม่ผูก" (คำร้องไม่มี LINE link)

ข้อมูลมาจาก `GET /api/reports/{id}` ที่ JOIN `line_users` แล้วคืน `line_user_id` / `line_is_friend` / `line_display_name`

## ฐานข้อมูล Schema

### ตาราง `line_users`
```sql
CREATE TABLE line_users (
  line_user_id int NOT NULL AUTO_INCREMENT,        -- Primary Key (อ้างอิงจาก reports)
  line_user_id_str varchar(50) NOT NULL,           -- LINE User ID จาก LINE API
  display_name varchar(255),                       -- ชื่อที่แสดงใน LINE
  picture_url varchar(500),                        -- URL รูปโปรไฟล์
  status_message text,                             -- ข้อความสถานะ
  is_friend boolean DEFAULT false,                 -- เป็นเพื่อน OA หรือไม่
  friend_added_at datetime,                        -- วันที่เพิ่มเพื่อน
  last_active_at datetime,                         -- วันที่ใช้งานล่าสุด
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (line_user_id),
  UNIQUE KEY idx_line_user_id_str (line_user_id_str)
);
```

### คอลัมน์ใหม่ใน `reports`
```sql
ALTER TABLE reports
  ADD COLUMN line_user_id int,                     -- เชื่อมโยงไปยัง line_users.line_user_id
  ADD COLUMN tracking_token varchar(64),           -- Token สำหรับความปลอดภัย
  ADD CONSTRAINT fk_reports_line_user FOREIGN KEY (line_user_id) REFERENCES line_users(line_user_id);
```

### 📊 ตัวอย่างข้อมูลการเชื่อมโยง:

#### **ตาราง `line_users`:**
| line_user_id | line_user_id_str | display_name | is_friend | friend_added_at |
|-------------|------------------|-------------|-----------|-----------------|
| 1          | U1234567890abcdef | สมชาย ใจดี | true      | 2024-01-15 10:30:00 |

#### **ตาราง `reports`:**
| report_id | line_user_id | tracking_token | status |
|-----------|-------------|----------------|--------|
| 1001     | 1          | abc123def456... | รอดำเนินการ |

#### **การ JOIN เพื่อดูข้อมูล:**
```sql
SELECT
  r.report_id,
  r.full_name as applicant_name,
  lu.line_user_id_str,
  lu.display_name as line_display_name,
  r.status,
  r.submitted_at
FROM reports r
INNER JOIN line_users lu ON r.line_user_id = lu.line_user_id
WHERE r.line_user_id IS NOT NULL;
```

**ผลลัพธ์:**
| report_id | applicant_name | line_user_id_str | line_display_name | status | submitted_at |
|-----------|----------------|------------------|-------------------|--------|-------------|
| 1001     | สมชาย ใจดี   | U1234567890abcdef | สมชาย ใจดี     | รอดำเนินการ | 2024-01-15 09:00:00 |

## การทดสอบ (UAT)

### 1. ทดสอบการยื่นคำร้องและเชื่อมต่อ LINE
```bash
# สร้างคำร้องใหม่
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "นาย",
    "full_name": "ทดสอบ ระบบ",
    "age": "30",
    "phone_number": "0812345678",
    "id_or_passport_number": "1234567890123",
    "sub_district": "หัวหิน",
    "district": "หัวหิน",
    "province": "ประจวบคีรีขันธ์",
    "postal_code": "77110",
    "category_id": 1,
    "request_type": "ขอดูข้อมูลรูปภาพ",
    "incident_date": "2024-01-15",
    "incident_time": "14:30",
    "incident_location": "ถนนเพชรเกษม",
    "involvement_role": "ผู้เสียหาย",
    "consent": true
  }'
```

### 2. ทดสอบ Flow ปุ่มเดียว
1. **เปิด success page**: `http://localhost:4000/success?id={report_id}&token={tracking_token}`
2. **กด "เชื่อมต่อกับ LINE OA"**
3. **ระบบจะเปิด LIFF**: `http://localhost:4000/liff/link?report_id={id}&t={token}`
4. **LIFF จัดการอัตโนมัติ**:
   - ถ้ายังไม่ login → เปิดหน้า login
   - ถ้ายังไม่เป็นเพื่อน → เปิดหน้าเพิ่มเพื่อน
   - เชื่อมต่อสำเร็จ → แสดงข้อความสำเร็จ

### 3. ทดสอบการส่ง notification ไปยังกลุ่ม
เมื่อสร้างคำร้องใหม่ ระบบจะส่งแจ้งเตือนไปยังกลุ่ม LINE โดยอัตโนมัติ

### 4. ทดสอบการส่ง notification แบบ manual
```bash
# ทดสอบส่งแจ้งเตือนไปยังกลุ่มสำหรับคำร้องที่มีอยู่
curl -X POST http://localhost:4000/api/test/group-notification \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": 123
  }'
```

### 5. ทดสอบการส่ง notification ไปยังผู้ใช้
```bash
# อัปเดตสถานะคำร้องเป็น "เอกสารอนุมัติเรียบร้อย"
curl -X PATCH http://localhost:4000/api/reports/{report_id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "เอกสารอนุมัติเรียบร้อย"
  }'
```

### 6. ตรวจสอบการเชื่อมโยง LINE User กับ Report
```bash
# ตรวจสอบข้อมูลในตาราง line_users
SELECT * FROM line_users WHERE line_user_id_str = 'Uxxxxxxxxxxxxxxxxxx';

# ตรวจสอบการเชื่อมโยงในตาราง reports
SELECT r.report_id, r.line_user_id, lu.line_user_id_str, lu.display_name
FROM reports r
LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id
WHERE r.report_id = {report_id};

# ตรวจสอบ activity logs
SELECT * FROM activity_logs
WHERE entity_type = 'report' AND entity_id = {report_id}
ORDER BY created_at DESC;
```

### 4. ทดสอบ LINE Webhook
```bash
# ส่ง webhook จาก LINE (เมื่อผู้ใช้ส่งข้อความ)
curl -X POST http://localhost:4000/api/line/webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: YOUR_SIGNATURE" \
  -d '{
    "events": [{
      "type": "message",
      "source": { "userId": "U1234567890abcdef" },
      "message": { "type": "text", "text": "สวัสดี" }
    }]
  }'
```

### 6. ทดสอบระบบ End-to-End
```bash
# สรุปขั้นตอนการทดสอบทั้งระบบ

# 1. สร้างคำร้อง (ระบบจะส่งแจ้งเตือนไปยังกลุ่ม LINE โดยอัตโนมัติ)
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -d '{"prefix":"นาย","full_name":"ทดสอบ","age":"30",...}'

# 2. ตรวจสอบ group notification logs
SELECT * FROM activity_logs WHERE action = 'GROUP_NOTIFICATION_SENT';

# 3. เปิด success page และกดปุ่มเชื่อมต่อ LINE

# 4. ตรวจสอบการเชื่อมโยง
SELECT r.report_id, r.line_user_id, lu.line_user_id_str
FROM reports r LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id;

# 5. อัปเดตสถานะเป็นอนุมัติ
curl -X PATCH http://localhost:4000/api/reports/{id} \
  -d '{"status":"เอกสารอนุมัติเรียบร้อย"}'

# 6. ตรวจสอบ notification logs
SELECT * FROM activity_logs WHERE action = 'NOTIFICATION_SENT';
```

## 🚀 **ขั้นตอนต่อไปหลังจากเชื่อมโยงสำเร็จ**

### **สำหรับ Production:**

1. **ติดตั้ง SQL Schema**:
   ```bash
   mysql -u root -p cctv_huahin < database/line_integration.sql
   ```

2. **ตั้งค่า Environment Variables**:
   ```bash
   # .env
   LINE_CHANNEL_ID=your_channel_id
   LINE_CHANNEL_SECRET=your_secret
   LINE_CHANNEL_ACCESS_TOKEN=your_token
   NEXT_PUBLIC_LIFF_ID=your_liff_id
   NEXT_PUBLIC_LINE_OA_BASIC_ID=@huahin_cctv
   NEXT_PUBLIC_BASE_URL=https://your-domain.com
   ```

3. **Deploy และทดสอบ**:
   - ✅ ทดสอบการเชื่อมต่อ LINE
   - ✅ ตรวจสอบ webhook logs
   - ✅ ทดสอบการส่ง notification
   - ✅ ตรวจสอบ database connections

### **สำหรับการ Monitor:**

1. **ติดตามจำนวนผู้ใช้ที่เชื่อมต่อ**:
   ```sql
   SELECT COUNT(*) as connected_users FROM reports WHERE line_user_id IS NOT NULL;
   ```

2. **ติดตามการส่ง notification**:
   ```sql
   SELECT COUNT(*) as notifications_sent FROM activity_logs WHERE action = 'NOTIFICATION_SENT';
   ```

3. **ตรวจสอบ webhook activity**:
   ```bash
   tail -f /tmp/cctv-logs/line-webhook.log
   ```

### **สำหรับการ Maintain:**

1. **Backup Database** อย่างสม่ำเสมอ
2. **Monitor LINE API Rate Limits**
3. **Update LINE Channel Tokens** ก่อนหมดอายุ
4. **Test Webhook** เป็นประจำ

## 🎯 **สรุป: ระบบพร้อมใช้งาน!**

✅ **LINE User เชื่อมโยงกับ Report** ผ่าน `line_user_id` แล้ว  
✅ **ส่ง Notification** อัตโนมัติเมื่ออนุมัติเอกสาร  
✅ **Flow ปุ่มเดียว** ทำงานได้อย่างสมบูรณ์  
✅ **Database Schema** พร้อมใช้งาน  
✅ **API Endpoints** ทำงานได้ปกติ  

ระบบ **LINE Integration** สำหรับ CCTV Request System พร้อมใช้งานจริงแล้ว! 🎉

## 📊 **การตรวจสอบและ Monitor ระบบ**

### **ตรวจสอบจำนวนผู้ใช้ที่เชื่อมต่อ LINE:**
```sql
-- ผู้ใช้ทั้งหมดที่เชื่อมต่อ LINE
SELECT COUNT(*) as total_connected_users
FROM reports
WHERE line_user_id IS NOT NULL;

-- สถิติการเชื่อมต่อรายเดือน
SELECT
  DATE_FORMAT(r.submitted_at, '%Y-%m') as month,
  COUNT(*) as reports_created,
  SUM(CASE WHEN r.line_user_id IS NOT NULL THEN 1 ELSE 0 END) as line_connected
FROM reports r
GROUP BY DATE_FORMAT(r.submitted_at, '%Y-%m')
ORDER BY month DESC;
```

### **ตรวจสอบการส่ง Notification:**
```sql
-- จำนวน notification ที่ส่งแล้ว
SELECT COUNT(*) as notifications_sent
FROM activity_logs
WHERE action = 'NOTIFICATION_SENT';

-- รายละเอียด notification ล่าสุด
SELECT
  al.created_at,
  al.description,
  r.report_id,
  r.full_name,
  lu.line_user_id_str
FROM activity_logs al
JOIN reports r ON al.entity_id = r.report_id
LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id
WHERE al.action = 'NOTIFICATION_SENT'
ORDER BY al.created_at DESC
LIMIT 10;
```

### **ตรวจสอบ LINE Users ที่ใช้งาน:**
```sql
-- LINE users ที่ active ล่าสุด
SELECT
  line_user_id,
  line_user_id_str,
  display_name,
  is_friend,
  last_active_at,
  friend_added_at
FROM line_users
ORDER BY last_active_at DESC
LIMIT 20;

-- สถิติการใช้งาน LINE
SELECT
  COUNT(*) as total_line_users,
  SUM(CASE WHEN is_friend = true THEN 1 ELSE 0 END) as friends_count,
  AVG(TIMESTAMPDIFF(DAY, friend_added_at, NOW())) as avg_days_since_friend
FROM line_users
WHERE friend_added_at IS NOT NULL;
```

### **Dashboard สำหรับ Admin:**
```sql
-- Overview dashboard
SELECT
  (SELECT COUNT(*) FROM reports WHERE DATE(submitted_at) = CURDATE()) as reports_today,
  (SELECT COUNT(*) FROM reports WHERE line_user_id IS NOT NULL) as total_line_connected,
  (SELECT COUNT(*) FROM activity_logs WHERE action = 'NOTIFICATION_SENT' AND DATE(created_at) = CURDATE()) as notifications_today,
  (SELECT COUNT(*) FROM line_users WHERE is_friend = true) as active_friends
FROM dual;
```

## 🛠️ **การแก้ไขปัญหาและ Troubleshooting**

### **1. Webhook ไม่ทำงาน**
- ✅ ตรวจสอบ Webhook URL: `https://your-domain.com/api/line/webhook`
- ✅ ตรวจสอบ LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN
- ✅ ตรวจสอบว่า OA Channel เปิด Webhook และปิด Auto-reply
- ✅ ตรวจสอบ log files: `tail -f /tmp/cctv-logs/line-webhook.log`

### **2. LIFF ไม่โหลด**
- ✅ ตรวจสอบ NEXT_PUBLIC_LIFF_ID จาก Login Channel
- ✅ ตรวจสอบ LIFF endpoint: `https://your-domain.com/liff/link`
- ✅ ตรวจสอบ console log สำหรับ LIFF errors
- ✅ ตรวจสอบว่า LIFF Channel ตั้งค่า Bot link ถูกต้อง

### **3. Bot Link ไม่ทำงาน**
- ✅ ตรวจสอบ NEXT_PUBLIC_LINE_OA_BASIC_ID (เช่น @huahin_cctv)
- ✅ ตรวจสอบ Bot link ชี้ไปที่ OA Channel ที่ถูกต้อง
- ✅ ตรวจสอบ Bot Prompt: `aggressive`
- ✅ ทดสอบโดยการเปิด LIFF ตรงๆ ใน LINE

### **4. ไม่ได้รับ notification**
- ✅ ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ยังไม่หมดอายุ
- ✅ ตรวจสอบว่า report มี line_user_id หรือไม่
- ✅ ตรวจสอบ activity_logs และ webhook logs
- ✅ ทดสอบส่ง notification ด้วย curl

### **5. Database Connection Error**
- ✅ ตรวจสอบ DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- ✅ ตรวจสอบว่าได้รัน `database/line_integration.sql` แล้ว
- ✅ ตรวจสอบ MySQL connection limits

### **6. LINE API Errors**
- ✅ ตรวจสอบ API rate limits
- ✅ ตรวจสอบ LINE Channel permissions
- ✅ ตรวจสอบ LIFF scopes: `openid`, `profile`

## 📋 **Log Files สำคัญ**

```bash
# Webhook logs
tail -f /tmp/cctv-logs/line-webhook.log

# Application logs (ถ้ามี)
tail -f /var/log/application.log

# MySQL error logs
tail -f /var/log/mysql/error.log
```

## 🔒 **ความปลอดภัย**

- ✅ **tracking_token** ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต
- ✅ **LINE signature verification** เปิดใช้งาน
- ✅ **Database prepared statements** ป้องกัน SQL injection
- ✅ **HTTPS required** สำหรับ production

## 🚀 **สำหรับ Production Deployment**

### **Pre-deployment Checklist:**
1. ✅ ตั้งค่า HTTPS สำหรับ webhook
2. ✅ ตรวจสอบ LIFF app เปิดใช้งาน
3. ✅ ตั้งค่า Bot link และ Bot Prompt
4. ✅ ทดสอบ webhook connectivity
5. ✅ Backup database ก่อน deploy

### **Post-deployment Monitoring:**
1. ✅ Monitor webhook response times
2. ✅ Track LINE API rate limit usage
3. ✅ Monitor notification delivery success
4. ✅ Regular database backups

### **Maintenance Tasks:**
1. ✅ Renew LINE Channel tokens ก่อนหมดอายุ
2. ✅ Update LINE SDK versions เมื่อมีอัปเดต
3. ✅ Monitor database growth และ optimize queries
4. ✅ Regular security audits

---

## 🎯 **สรุป: ระบบพร้อมใช้งาน Production!**

ระบบ **LINE Integration** สำหรับ CCTV Request System ได้รับการพัฒนาและทดสอบครบถ้วนแล้ว พร้อมใช้งานจริง! 🎉

**Key Features:**
- ✅ ปุ่มเดียวเชื่อมต่อ LINE OA + ผูกคำร้อง
- ✅ ส่ง notification อัตโนมัติเมื่ออนุมัติ
- ✅ Database schema ครบถ้วน
- ✅ Error handling และ logging
- ✅ Production-ready monitoring

**Next Steps:**
1. Deploy to production server
2. Configure environment variables
3. Test end-to-end flow
4. Monitor system performance
5. Setup automated backups

ระบบทำงานได้อย่างสมบูรณ์แล้วครับ! 🚀
