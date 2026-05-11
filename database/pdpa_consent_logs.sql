-- PDPA Consent Logs
-- Version: 2026-05-08
-- Description: เก็บหลักฐานการให้/ปฏิเสธความยินยอม (Consent) ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล
--              ใช้เป็นหลักฐานเชิงตรวจสอบ (audit) ว่าผู้ใช้รายใด ยินยอมเมื่อไหร่ ภายใต้ Privacy Notice เวอร์ชันใด
--              จาก IP / User-Agent ใด และผูกกับคำร้อง / LINE user (ถ้ามี)
--
-- หมายเหตุ:
--   * เก็บแบบ append-only — ห้าม UPDATE/DELETE record เก่า (ทำให้เป็นหลักฐาน)
--   * เวอร์ชัน Privacy Notice ระบุชัดเจน เพื่อรองรับการเปลี่ยนแปลงเงื่อนไขในอนาคต
--   * เก็บทั้ง action='accepted' และ 'rejected' เพื่อพิสูจน์ทั้งกรณียินยอมและไม่ยินยอม

USE `cctv_huahin`;

CREATE TABLE IF NOT EXISTS `consent_logs` (
  `consent_id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `consent_type`       VARCHAR(64) NOT NULL DEFAULT 'pdpa_privacy_notice'
    COMMENT 'ประเภทของ consent เช่น pdpa_privacy_notice, marketing_consent',
  `policy_version`     VARCHAR(32) NOT NULL
    COMMENT 'เวอร์ชันของ Privacy Notice ที่ผู้ใช้ยินยอม เช่น "2026-05-08"',
  `action`             ENUM('accepted','rejected','withdrawn') NOT NULL
    COMMENT 'accepted = ติ๊กยินยอม, rejected = ไม่ยินยอม, withdrawn = ถอนความยินยอมภายหลัง',
  `subject_type`       ENUM('applicant','line_user','admin','anonymous') NOT NULL DEFAULT 'anonymous'
    COMMENT 'บทบาทของผู้ให้ consent',
  `line_user_id_str`   VARCHAR(50) DEFAULT NULL
    COMMENT 'LINE userId (ถ้าผู้ใช้เปิดผ่าน LIFF/login แล้ว)',
  `report_id`          INT DEFAULT NULL
    COMMENT 'รหัสคำร้องที่เกี่ยวข้อง (อาจ NULL ถ้ายินยอมก่อนสร้างคำร้อง)',
  `id_or_passport_hash` CHAR(64) DEFAULT NULL
    COMMENT 'SHA-256 ของเลขบัตร/พาสปอร์ต (เก็บแบบ hash เพื่อจับคู่ภายหลัง โดยไม่ต้องเก็บค่าจริง)',
  `ip_address`         VARCHAR(45) NOT NULL
    COMMENT 'IPv4 / IPv6 ของผู้ให้ consent (สำคัญในเชิงหลักฐาน)',
  `user_agent`         TEXT DEFAULT NULL
    COMMENT 'HTTP User-Agent ของอุปกรณ์',
  `locale`             VARCHAR(8) DEFAULT NULL
    COMMENT 'ภาษาที่ผู้ใช้เห็นตอนยินยอม เช่น th, en',
  `page_path`          VARCHAR(255) DEFAULT NULL
    COMMENT 'path ของหน้าที่แสดง consent (เช่น /request)',
  `metadata`           JSON DEFAULT NULL
    COMMENT 'ข้อมูลเสริม (เช่น referrer, device hint)',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'เวลาที่บันทึก consent (UTC+07:00)',
  PRIMARY KEY (`consent_id`),
  KEY `idx_consent_line_user`    (`line_user_id_str`),
  KEY `idx_consent_report`       (`report_id`),
  KEY `idx_consent_idhash`       (`id_or_passport_hash`),
  KEY `idx_consent_created_at`   (`created_at`),
  KEY `idx_consent_action_type`  (`action`, `consent_type`),
  CONSTRAINT `fk_consent_logs_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='PDPA Consent Audit Log (append-only)';

-- บันทึกเวอร์ชันปัจจุบันของ Privacy Notice ลงใน system_settings
-- เพื่อให้ frontend / backend อ่านค่าตรงกัน และเปลี่ยนเวอร์ชันได้โดยไม่ต้อง deploy code
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `category`, `description`, `is_public`)
VALUES
  ('pdpa_privacy_notice_version', '2026-05-08', 'pdpa', 'เวอร์ชันปัจจุบันของ Privacy Notice (PDPA)', true),
  ('pdpa_privacy_notice_effective_at', '2026-05-08', 'pdpa', 'วันที่ Privacy Notice เวอร์ชันปัจจุบันมีผลบังคับใช้', true)
ON DUPLICATE KEY UPDATE
  `setting_value` = VALUES(`setting_value`),
  `description`   = VALUES(`description`),
  `is_public`     = VALUES(`is_public`);
