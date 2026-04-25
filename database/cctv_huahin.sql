-- CCTV Request Management System (Hua Hin) - Fixed & Aligned Schema
-- Version: 2025-09-11
-- Notes:
-- * Orders tables to satisfy FKs
-- * Adds missing columns used in inserts and indexes
-- * Aligns ENUMs with UI/usage, and fixes invalid indexes
-- * Provides required auxiliary tables (system_settings, status_history)
-- * Renames `timestamp` -> `submitted_at` to avoid confusion

DROP DATABASE IF EXISTS `cctv_huahin`;
CREATE DATABASE `cctv_huahin` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cctv_huahin`;

SET NAMES utf8mb4;

-- 0) Officers (create first for FK in reports)
CREATE TABLE `officers` (
  `officer_id` int NOT NULL AUTO_INCREMENT,
  `prefix` varchar(10) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `position` varchar(100) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`officer_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_position` (`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางเจ้าหน้าที่';

-- 1) Reports (คำร้อง)
CREATE TABLE `reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, -- renamed from `timestamp`

  -- Personal info
  `prefix` varchar(10) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `age` int(3) DEFAULT NULL,
  `id_or_passport_number` varchar(20) NOT NULL,
  `phone_number` varchar(15) NOT NULL,

  -- Address
  `house_number` varchar(50) DEFAULT NULL,
  `village_number` varchar(10) DEFAULT NULL,
  `alley` varchar(100) DEFAULT NULL,
  `road` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,

  -- Language
  `language` enum('th','en') DEFAULT 'th',

  -- Request details
  `category_id` int DEFAULT NULL,
  `request_type` enum('ขอดูข้อมูลรูปภาพ','ขอสำเนาข้อมูลภาพ') NOT NULL,
  `request_details` text DEFAULT NULL,
  `incident_date` date DEFAULT NULL,
  `incident_time` varchar(20) DEFAULT NULL,
  `incident_location` text DEFAULT NULL,

  -- Involvement
  `involvement_role` varchar(100) DEFAULT NULL,
  `involvement_explain` text DEFAULT NULL,

  -- Status
  `status` enum(
    'รอดำเนินการ',
  'รอเอกสารอนุมัติ',
  'เอกสารอนุมัติเรียบร้อย',
  'ปฏิเสธคำร้อง'
  ) DEFAULT 'รอดำเนินการ',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `status_updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,

  -- Officer & notes
  `assigned_officer_id` int DEFAULT NULL,
  `officer_comments` text DEFAULT NULL,
  `officer_decision` enum('อนุญาต','ไม่อนุญาต','รอพิจารณา','ต้องการข้อมูลเพิ่มเติม') DEFAULT NULL,

  -- Notifications
  `notification_sent_at` datetime DEFAULT NULL,

  -- Notes
  `internal_notes` text DEFAULT NULL,
  `public_notes` text DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,

  -- PDF
  `pdf_url` varchar(500) DEFAULT NULL,
  `pdf_generated_at` datetime DEFAULT NULL,

  -- Audit
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(100) DEFAULT 'system',
  `updated_by` varchar(100) DEFAULT NULL,

  PRIMARY KEY (`report_id`),
  KEY `idx_id_phone` (`id_or_passport_number`, `phone_number`),
  KEY `idx_status` (`status`),
  KEY `idx_incident_date` (`incident_date`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_assigned_officer` (`assigned_officer_id`),
  KEY `idx_status_priority` (`status`, `priority`),
  CONSTRAINT `fk_reports_officer` FOREIGN KEY (`assigned_officer_id`) REFERENCES `officers` (`officer_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางคำร้องขอดูภาพ CCTV';

-- 2) Request documents
CREATE TABLE `request_documents` (
  `doc_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `document_type` enum(
    'id_card_copy',
    'passport_copy',
    'police_report',
    'incident_report',
    'power_of_attorney',
    'legal_document',
    'supporting_document'
  ) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by_ip` varchar(45) DEFAULT NULL,
  `is_deleted` boolean NOT NULL DEFAULT false,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`doc_id`),
  KEY `fk_request_documents_report` (`report_id`),
  KEY `idx_document_type` (`document_type`),
  KEY `idx_verification_status` (`verification_status`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  CONSTRAINT `fk_request_documents_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='เอกสารแนบของผู้ยื่นคำร้อง';

-- 3) CCTV images
CREATE TABLE `cctv_images` (
  `image_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint NOT NULL,
  `mime_type` varchar(100) NOT NULL DEFAULT 'image/jpeg',

  `camera_id` varchar(50) DEFAULT NULL,
  `camera_location` varchar(255) DEFAULT NULL,
  `captured_at` datetime DEFAULT NULL,
  `description` text DEFAULT NULL,

  `approval_status` enum('รอดำเนินการ','พร้อมใช้งาน','ไม่พร้อมใช้งาน','กำลังตรวจสอบ') DEFAULT 'รอดำเนินการ',
  `approved_by` varchar(100) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,

  `access_level` enum('public','restricted','confidential') DEFAULT 'restricted',
  `download_count` int DEFAULT 0,
  `view_count` int DEFAULT 0,
  `last_accessed_at` datetime DEFAULT NULL,

  `uploaded_by` varchar(100) DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` boolean NOT NULL DEFAULT false,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` varchar(100) DEFAULT NULL,

  PRIMARY KEY (`image_id`),
  KEY `fk_cctv_images_report` (`report_id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_captured_at` (`captured_at`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  CONSTRAINT `fk_cctv_images_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ภาพ CCTV ที่เจ้าหน้าที่อัปโหลด';

-- 4) CCTV videos
CREATE TABLE `cctv_videos` (
  `video_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint NOT NULL,
  `mime_type` varchar(100) NOT NULL DEFAULT 'video/mp4',

  `duration_seconds` int DEFAULT NULL,
  `resolution_width` int DEFAULT NULL,
  `resolution_height` int DEFAULT NULL,
  `camera_id` varchar(50) DEFAULT NULL,
  `camera_location` varchar(255) DEFAULT NULL,
  `recording_start` datetime DEFAULT NULL,
  `recording_end` datetime DEFAULT NULL,
  `description` text DEFAULT NULL,

  `approval_status` enum('รอดำเนินการ','พร้อมใช้งาน','ไม่พร้อมใช้งาน','กำลังตรวจสอบ') DEFAULT 'รอดำเนินการ',
  `approved_by` varchar(100) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,

  `access_level` enum('public','restricted','confidential') DEFAULT 'restricted',
  `download_count` int DEFAULT 0,
  `view_count` int DEFAULT 0,
  `last_accessed_at` datetime DEFAULT NULL,

  `uploaded_by` varchar(100) DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` boolean NOT NULL DEFAULT false,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` varchar(100) DEFAULT NULL,

  PRIMARY KEY (`video_id`),
  KEY `fk_cctv_videos_report` (`report_id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_recording_start` (`recording_start`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  CONSTRAINT `fk_cctv_videos_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='วิดีโอ CCTV ที่เจ้าหน้าที่อัปโหลด';

-- 5) File access logs
CREATE TABLE `file_access_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `file_type` enum('image','video','document') NOT NULL DEFAULT 'document',
  `file_id` int NOT NULL DEFAULT 0,
  `action` enum('view','download','stream','share') NOT NULL,
  `access_method` enum('web','api','admin_panel') DEFAULT 'web',
  `accessed_by_type` enum('applicant','admin','officer','anonymous') NOT NULL,
  `accessed_by_id` varchar(100) DEFAULT NULL,
  `accessed_by_name` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `referer` varchar(500) DEFAULT NULL,
  `session_id` varchar(128) DEFAULT NULL,
  `success` boolean NOT NULL DEFAULT true,
  `error_message` text DEFAULT NULL,
  `bytes_served` bigint DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `accessed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `fk_file_access_report` (`report_id`),
  KEY `idx_file_type_id` (`file_type`, `file_id`),
  KEY `idx_accessed_at` (`accessed_at`),
  KEY `idx_ip_address` (`ip_address`),
  KEY `idx_accessed_by` (`accessed_by_type`, `accessed_by_id`),
  CONSTRAINT `fk_file_access_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log การเข้าถึงไฟล์';

-- 6) Activity logs
CREATE TABLE `activity_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `activity_type` enum(
    'report_created',
    'report_updated',
    'status_changed',
    'document_uploaded',
    'document_verified',
    'media_uploaded',
    'media_approved',
    'user_login',
    'user_logout',
    'admin_action',
    'system_error'
  ) NOT NULL,
  `entity_type` enum('report','document','image','video','user','system') DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `actor_type` enum('system','admin','officer','applicant','anonymous') NOT NULL,
  `actor_id` varchar(100) DEFAULT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `success` boolean NOT NULL DEFAULT true,
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_entity` (`entity_type`, `entity_id`),
  KEY `idx_actor` (`actor_type`, `actor_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_ip_address` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Activity & Audit Log';

-- 7) Status history (used by trigger)
CREATE TABLE `status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `previous_status` varchar(100) NOT NULL,
  `new_status` varchar(100) NOT NULL,
  `changed_by` varchar(100) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_id` (`report_id`),
  CONSTRAINT `fk_status_history_report`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`report_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการเปลี่ยนสถานะคำร้อง';

-- 8) System settings (used by inserts)
CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_public` boolean NOT NULL DEFAULT false,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='การตั้งค่าระบบ';

-- 9) Categories (unchanged data, but ensure proper PK/AI)
CREATE TABLE `categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `categories` (`category_id`, `category_name`) VALUES
(1, 'ของหาย / ของถูกขโมย / ลืมของ'),
(2, 'อุบัติเหตุ / เหตุบนท้องถนน'),
(3, 'ความเสียหาย / ทำลายทรัพย์สิน'),
(4, 'บุคคลน่าสงสัย / การกระทำผิด'),
(5, 'เด็กหาย / คนหาย / คนพลัดหลง'),
(6, 'ตรวจสอบพฤติกรรมบุคคล / ความเคลื่อนไหว'),
(7, 'ตรวจสอบเหตุการณ์ย้อนหลัง'),
(8, 'ติดตามรถ / ยานพาหนะ'),
(9, 'ส่งของผิด / พัสดุหาย'),
(10, 'การฝ่าฝืนกฎในพื้นที่'),
(11, 'การซ่อมบำรุง / ก่อสร้างผิดเวลา'),
(12, 'รบกวนความสงบ / ปัญหาเพื่อนบ้าน / ทะเลาะวิวาท'),
(13, 'เหตุการณ์ในพื้นที่ส่วนรวม'),
(14, 'ไม่ระบุ'),
(15, 'ประสงค์ร้าย / ทำร้ายร่างกาย');

-- 10) Triggers for audit
DROP TRIGGER IF EXISTS `tr_reports_after_insert`;
DROP TRIGGER IF EXISTS `tr_reports_after_update`;
DELIMITER $$
CREATE TRIGGER `tr_reports_after_insert`
AFTER INSERT ON `reports`
FOR EACH ROW
BEGIN
  INSERT INTO `activity_logs` (
    `activity_type`, `entity_type`, `entity_id`,
    `actor_type`, `actor_id`, `action`, `description`,
    `new_values`, `ip_address`
  ) VALUES (
    'report_created', 'report', NEW.report_id,
    'system', NEW.created_by, 'CREATE',
    CONCAT('คำร้องใหม่ถูกสร้าง ID: ', NEW.report_id),
    JSON_OBJECT(
      'report_id', NEW.report_id,
      'full_name', NEW.full_name,
      'status', NEW.status,
      'request_type', NEW.request_type
    ),
    NULL
  );
END$$

CREATE TRIGGER `tr_reports_after_update`
AFTER UPDATE ON `reports`
FOR EACH ROW
BEGIN
  DECLARE activity_desc TEXT;
  SET activity_desc = CONCAT('คำร้อง ID ', OLD.report_id, ' ถูกอัปเดต');

  IF OLD.status != NEW.status THEN
    INSERT INTO `status_history` (
      `report_id`, `previous_status`, `new_status`,
      `changed_by`, `changed_at`, `notes`
    ) VALUES (
      NEW.report_id, OLD.status, NEW.status,
      COALESCE(NEW.updated_by, 'system'), NOW(),
      CONCAT('เปลี่ยนจาก "', OLD.status, '" เป็น "', NEW.status, '"')
    );

    SET activity_desc = CONCAT('สถานะเปลี่ยนจาก "', OLD.status, '" เป็น "', NEW.status, '"');
  END IF;

  INSERT INTO `activity_logs` (
    `activity_type`, `entity_type`, `entity_id`,
    `actor_type`, `actor_id`, `action`, `description`,
    `old_values`, `new_values`, `ip_address`
  ) VALUES (
    IF(OLD.status != NEW.status, 'status_changed', 'report_updated'),
    'report', NEW.report_id,
    'system', NEW.updated_by, 'UPDATE',
    activity_desc,
    JSON_OBJECT(
      'status', OLD.status,
      'officer_comments', OLD.officer_comments,
      'updated_at', OLD.updated_at
    ),
    JSON_OBJECT(
      'status', NEW.status,
      'officer_comments', NEW.officer_comments,
      'updated_at', NEW.updated_at
    ),
    NULL
  );
END$$
DELIMITER ;

-- 11) Seed data

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `category`, `description`, `is_public`) VALUES
('site_name', 'ระบบจัดการคำร้องขอดูภาพ CCTV', 'general', 'ชื่อเว็บไซต์', true),
('max_file_size_mb', '50', 'uploads', 'ขนาดไฟล์สูงสุดที่อัปโหลดได้ (MB)', false),
('allowed_file_types', '["pdf","jpg","jpeg","png","mp4","avi"]', 'uploads', 'ประเภทไฟล์ที่อนุญาต', false),
('request_expiry_days', '30', 'requests', 'จำนวนวันที่คำร้องหมดอายุ', false),
('auto_assign_officer', 'true', 'workflow', 'มอบหมายงานอัตโนมัติ', false),
('notification_email', 'admin@huahin.go.th', 'notifications', 'อีเมลสำหรับแจ้งเตือน', false),
('office_hours_start', '08:30', 'general', 'เวลาเริ่มทำการ', true),
('office_hours_end', '16:30', 'general', 'เวลาสิ้นสุดการทำงาน', true),
('support_phone', '032-123-4567', 'contact', 'เบอร์โทรสำนักงาน', true),
('data_retention_days', '2555', 'security', 'จำนวนวันเก็บข้อมูล (7 ปี)', false);

INSERT INTO `officers` (`prefix`, `full_name`, `position`, `phone`, `email`, `is_active`) VALUES
('นาย', 'สมชาย ใจดี', 'เจ้าหน้าที่ดูแลระบบ', '032-123-4567', 'somchai@huahin.go.th', true),
('นางสาว', 'สมศรี สวยงาม', 'เจ้าหน้าที่ธุรการ', '032-123-4568', 'somsri@huahin.go.th', true),
('นาย', 'ประสิทธิ์ มีชัย', 'หัวหน้าฝ่าย', '032-123-4569', 'prasit@huahin.go.th', true);

INSERT INTO `reports` (
  `submitted_at`, `prefix`, `full_name`, `age`, `id_or_passport_number`, `phone_number`,
  `house_number`, `village_number`, `alley`, `road`, `sub_district`, `district`, `province`, `postal_code`,
  `request_type`, `request_details`, `incident_date`, `incident_time`, `incident_location`, `status`
) VALUES
('2024-12-15 14:30:00', 'นาย', 'สมชาย ใจดี', 35, '1234567890123', '0812345678',
 '123/45', '7', 'ซอยสวย', 'ถนนเพชรเกษม', 'หัวหิน', 'หัวหิน', 'ประจวบคีรีขันธ์', '77110',
 'ขอดูข้อมูลรูปภาพ', 'ขอดูภาพกล้องวงจรปิดช่วงเวลาที่เกิดอุบัติเหตุรถชน เพื่อใช้ประกอบการเคลมประกัน',
 '2024-12-15', '14:30:00', 'ถนนเพชรเกษม กม.230 หน้าโรงแรม ABC Hotel', 'เอกสารอนุมัติเรียบร้อย'),
('2024-12-10 09:15:00', 'นางสาว', 'สมศรี สวยงาม', 28, '9876543210987', '0897654321',
 '67/89', '12', '', 'ถนนหัวหิน', 'หัวหิน', 'หัวหิน', 'ประจวบคีรีขันธ์', '77110',
 'ขอสำเนาข้อมูลภาพ', 'ขอสำเนาภาพกล้องวงจรปิดเพื่อประกอบการพิจารณาคดีความในศาล',
 '2024-12-10', '09:15:00', 'ตลาดน้ำหัวหิน บริเวณทางเข้าหลัก', 'รอเอกสารอนุมัติ'),
('2024-12-12 16:45:00', 'นาง', 'มาลี ดอกไม้', 42, '5555666677778', '0865559999',
 '999/1', '5', 'ซอยร่วมใจ', 'ถนนพัทยา', 'หัวหิน', 'หัวหิน', 'ประจวบคีรีขันธ์', '77110',
 'ขอดูข้อมูลรูปภาพ', 'ขอดูภาพกล้องเหตุการณ์ทะเลาะวิวาทที่เกิดขึ้นหน้าร้านอาหาร',
 '2024-12-12', '16:45:00', 'ร้านอาหารริมทะเล หัวหิน ซอยพัทยา 5', 'รอดำเนินการ');

INSERT INTO `cctv_images` (
  `report_id`, `file_name`, `file_path`, `file_size`, `mime_type`,
  `camera_id`, `camera_location`, `captured_at`, `description`,
  `approval_status`, `approved_by`, `approved_at`, `uploaded_by`
) VALUES
(1, 'camera_01_20241215_1430.jpg', '/storage/cctv/images/2024/12/camera_01_20241215_1430.jpg',
 2048576, 'image/jpeg', 'CAM-001', 'ถนนเพชรเกษม กม.230', '2024-12-15 14:30:15',
 'ภาพจากกล้องจุดที่ 1 แสดงเหตุการณ์อุบัติเหตุรถชน',
 'พร้อมใช้งาน', 'admin', '2024-12-16 09:00:00', 'officer001'),
(1, 'camera_02_20241215_1432.jpg', '/storage/cctv/images/2024/12/camera_02_20241215_1432.jpg',
 1876543, 'image/jpeg', 'CAM-002', 'ถนนเพชรเกษม กม.230 (มุม 2)', '2024-12-15 14:32:08',
 'ภาพจากกล้องจุดที่ 2 แสดงหลังเกิดเหตุ',
 'พร้อมใช้งาน', 'admin', '2024-12-16 09:00:00', 'officer001'),
(2, 'market_cam_01_20241210_0915.jpg', '/storage/cctv/images/2024/12/market_cam_01_20241210_0915.jpg',
 3145728, 'image/jpeg', 'CAM-MARKET-01', 'ตลาดน้ำหัวหิน ทางเข้าหลัก', '2024-12-10 09:15:30',
 'ภาพจากกล้องตลาดน้ำ จุดที่ 1',
 'พร้อมใช้งาน', 'admin', '2024-12-11 10:30:00', 'officer002');

INSERT INTO `cctv_videos` (
  `report_id`, `file_name`, `file_path`, `file_size`, `mime_type`,
  `duration_seconds`, `resolution_width`, `resolution_height`,
  `camera_id`, `camera_location`, `recording_start`, `recording_end`,
  `description`, `approval_status`, `approved_by`, `approved_at`, `uploaded_by`
) VALUES
(1, 'incident_20241215_1425-1435.mp4', '/storage/cctv/videos/2024/12/incident_20241215_1425-1435.mp4',
 52428800, 'video/mp4', 600, 1920, 1080,
 'CAM-001', 'ถนนเพชรเกษม กม.230', '2024-12-15 14:25:00', '2024-12-15 14:35:00',
 'วิดีโอ 10 นาที แสดงเหตุการณ์อุบัติเหตุรถชนตั้งแต่ก่อนเกิดเหตุจนหลังเกิดเหตุ',
 'พร้อมใช้งาน', 'admin', '2024-12-16 09:00:00', 'officer001'),
(2, 'market_incident_20241210_0910-0920.mp4', '/storage/cctv/videos/2024/12/market_incident_20241210_0910-0920.mp4',
 41943040, 'video/mp4', 600, 1280, 720,
 'CAM-MARKET-01', 'ตลาดน้ำหัวหิน ทางเข้าหลัก', '2024-12-10 09:10:00', '2024-12-10 09:20:00',
 'วิดีโอเหตุการณ์ที่ตลาดน้ำ 10 นาที',
 'กำลังตรวจสอบ', NULL, NULL, 'officer002');


USE `cctv_huahin`;

-- 1) เพิ่มคอลัมน์ (วางไว้ถัดจาก request_type เพื่ออ่านง่าย)
ALTER TABLE `reports`
  ADD COLUMN `category_id` INT NULL AFTER `request_type`;

-- 2) สร้างดัชนี
ALTER TABLE `reports`
  ADD INDEX `idx_reports_category_id` (`category_id`);

-- 3) ผูก Foreign Key (ลบหมวดหมู่ = ตั้งค่า NULL ในรายงาน; อัปเดต id = cascade)
ALTER TABLE `reports`
  ADD CONSTRAINT `fk_reports_category_id`
    FOREIGN KEY (`category_id`)
    REFERENCES `categories` (`category_id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- 4) Fix file_access_logs defaults (แก้ไขปัญหา missing file_id and file_type)
ALTER TABLE `file_access_logs`
  MODIFY COLUMN `file_type` enum('image','video','document') NOT NULL DEFAULT 'document',
  MODIFY COLUMN `file_id` int NOT NULL DEFAULT 0;
