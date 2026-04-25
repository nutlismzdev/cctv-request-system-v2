-- Migration: Update status ENUM to use only 4 statuses
-- Date: 2025-09-13
-- Description: Update reports.status ENUM to include only: รอดำเนินการ, รอเอกสารอนุมัติ, เอกสารอนุมัติเรียบร้อย, ปฏิเสธคำร้อง

USE `cctv_huahin`;

-- Step 1: Update existing data to map old statuses to new ones
-- Map old statuses to the closest matching new status:

-- 'กำลังตรวจสอบเอกสาร' -> 'รอเอกสารอนุมัติ'
UPDATE `reports` SET `status` = 'รอเอกสารอนุมัติ' WHERE `status` = 'กำลังตรวจสอบเอกสาร';

-- 'กำลังรวบรวมข้อมูล' -> 'รอเอกสารอนุมัติ'
UPDATE `reports` SET `status` = 'รอเอกสารอนุมัติ' WHERE `status` = 'กำลังรวบรวมข้อมูล';

-- 'รอการอนุมัติ' -> 'เอกสารอนุมัติเรียบร้อย'
UPDATE `reports` SET `status` = 'เอกสารอนุมัติเรียบร้อย' WHERE `status` = 'รอการอนุมัติ';

-- 'เสร็จสิ้น' -> 'เอกสารอนุมัติเรียบร้อย'
UPDATE `reports` SET `status` = 'เอกสารอนุมัติเรียบร้อย' WHERE `status` = 'เสร็จสิ้น';

-- 'ยกเลิก' -> 'ปฏิเสธคำร้อง'
UPDATE `reports` SET `status` = 'ปฏิเสธคำร้อง' WHERE `status` = 'ยกเลิก';

-- Step 2: Update the ENUM definition to include only the 4 desired statuses
ALTER TABLE `reports`
MODIFY COLUMN `status` ENUM(
  'รอดำเนินการ',
  'รอเอกสารอนุมัติ',
  'เอกสารอนุมัติเรียบร้อย',
  'ปฏิเสธคำร้อง'
) DEFAULT 'รอดำเนินการ';

-- Step 3: Verify the changes
-- You can run this query to check the status distribution after migration:
-- SELECT status, COUNT(*) as count FROM reports GROUP BY status ORDER BY count DESC;
