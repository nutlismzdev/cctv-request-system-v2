
• ตั้งใน LINE Developers Console ครับ ต้องทำใน LINE Login Channel ที่สร้าง LIFF app 2008141300-2BMrmr94

  ขั้นตอน:

  1. เข้า https://developers.line.biz/console/
  2. เลือก Provider เดียวกับระบบนี้
  3. เข้า LINE Login Channel ที่มี LIFF ID 2008141300-2BMrmr94
  4. ไปแท็บ Basic settings
  5. หาเมนู Linked LINE Official Account
  6. กด Edit
  7. เลือก LINE OA/Bot ที่ต้องการให้ผู้ใช้ add friend
  8. กด Update / Save

  เงื่อนไขสำคัญ:

  - LINE OA นั้นต้องมี Messaging API channel
  - Messaging API channel ของ OA ต้องอยู่ใน Provider เดียวกัน กับ LINE Login Channel
  - บัญชีคุณต้องเป็น admin ทั้ง LINE Login Channel และ LINE OA
  - 1 LINE Login Channel ผูก OA ได้ 1 ตัวเท่านั้น

  หลังจากผูกแล้ว ให้ไปที่แท็บ LIFF ของ channel เดิม แล้วเช็ค LIFF app:

  - Endpoint URL: https://cctvtest.itac-huahincity.com/request
  - Scope ต้องมี profile
  - Add friend option ควรเปิดเป็น On (normal) หรือ On (aggressive)

  ความหมายของ Add friend option:

  - On (normal) แสดงตัวเลือกเพิ่มเพื่อนบน consent screen
  - On (aggressive) แสดงหน้าชวนเพิ่มเพื่อนหลัง consent screen
  - Off ไม่ชวนเพิ่มเพื่อน แต่โค้ดยังเช็ค getFriendship() ได้ถ้าผูก OA แล้ว

  - https://developers.line.biz/en/docs/line-login/link-a-bot/
  - https://developers.line.biz/en/docs/liff/registering-liff-apps/
  - https://developers.line.biz/en/reference/liff/#get-friendship


› Messaging API ฉันมี สิทธ์ line oaเป็น admin แต่ Linked LINE Official Account  ไม่ขึ้น bot oaที่ฉันใช้


• สาเหตุที่ Linked LINE Official Account ไม่ขึ้น OA/Bot ที่ใช้ มักเกิดจากข้อใดข้อหนึ่งนี้ครับ:

  1. LINE Login Channel กับ Messaging API Channel อยู่คนละ Provider
      - อันนี้พบบ่อยที่สุด
      - LINE บังคับว่า OA ที่จะเอามา link ต้องมี Messaging API channel อยู่ใน Provider เดียวกัน กับ LINE Login channel ที่สร้าง LIFF
      - ถ้า OA อยู่ Provider A แต่ LIFF/Login อยู่ Provider B จะไม่ขึ้นให้เลือก
  2. OA ยังไม่ได้เปิด Messaging API ใน LINE OA Manager
      - เข้า LINE Official Account Manager
      - เลือก OA
      - Settings > Messaging API
      - ต้องเปิด/เชื่อม Messaging API แล้ว
      - หลังเปิดแล้วจะเห็น Channel ID / Channel secret / Provider
  3. บัญชี LINE ที่ login เข้า Developers ไม่ใช่ admin ของ OA ตัวนั้น
      - ต้องเป็น admin ทั้ง 2 ที่:
          - LINE Developers channel
          - LINE Official Account Manager ของ OA
      - ถ้าเป็นแค่ operator/editor บางแบบ อาจไม่ขึ้น
  4. Messaging API Channel ถูกสร้างไว้ใต้ Provider อื่นไปแล้ว
      - ตอนเปิด Messaging API ใน OA Manager ระบบจะให้เลือก/สร้าง Provider
      - ถ้าเลือกผิด Provider จะ link กับ LINE Login Channel ปัจจุบันไม่ได้
      - วิธีเช็คคือดูใน LINE Developers ว่า Messaging API channel ของ OA อยู่ Provider ไหน
  5. OA นั้นถูก link กับ LINE Login channel อื่นอยู่แล้ว
      - โดยปกติ LINE Login channel link OA ได้ 1 ตัว
      - ถ้าใช้หลาย test/prod channel อาจต้องแยก OA หรือย้ายให้ถูก channel

  สิ่งที่ควรเช็คตอนนี้:

  1. เข้า LINE Developers
  2. เปิด Provider ที่มี LIFF ID 2008141300-2BMrmr94
  3. ดูว่าใน Provider เดียวกันนี้มี Messaging API channel ของ OA ที่คุณใช้หรือไม่
  4. ถ้าไม่มี แปลว่า OA อยู่คนละ Provider

  ทางแก้มี 2 ทาง:

  ทางที่แนะนำ: สร้าง LINE Login Channel / LIFF ใหม่ใน Provider เดียวกับ Messaging API ของ OA
  เพราะย้าย Messaging API channel ข้าม Provider มักทำไม่ได้ง่ายหรืออาจกระทบ OA เดิม


› Improve documentation in @filename

  gpt-5.5 default · C:\E-services\cctv-request-system-v2-master


