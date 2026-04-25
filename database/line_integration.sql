-- LINE Integration Tables for CCTV Request System
-- Version: 2025-01-19
-- Description: Add LINE user management and linking functionality

USE `cctv_huahin`;

-- 1) Create line_users table to store LINE user information
CREATE TABLE `line_users` (
  `line_user_id` int NOT NULL AUTO_INCREMENT,
  `line_user_id_str` varchar(50) NOT NULL COMMENT 'LINE User ID from LINE API',
  `display_name` varchar(255) DEFAULT NULL COMMENT 'Display name from LINE profile',
  `picture_url` varchar(500) DEFAULT NULL COMMENT 'Profile picture URL from LINE',
  `status_message` text DEFAULT NULL COMMENT 'Status message from LINE profile',
  `is_friend` boolean NOT NULL DEFAULT false COMMENT 'Whether user is friend with OA',
  `friend_added_at` datetime DEFAULT NULL COMMENT 'When user became friend with OA',
  `last_active_at` datetime DEFAULT NULL COMMENT 'Last activity timestamp',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`line_user_id`),
  UNIQUE KEY `idx_line_user_id_str` (`line_user_id_str`),
  KEY `idx_is_friend` (`is_friend`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='LINE users linked to the system';

-- 2) Add line_user_id and link_code columns to reports table
ALTER TABLE `reports`
  ADD COLUMN `line_user_id` int DEFAULT NULL AFTER `notification_sent_at`,
  ADD COLUMN `link_code` varchar(32) DEFAULT NULL AFTER `line_user_id`,
  ADD CONSTRAINT `fk_reports_line_user`
    FOREIGN KEY (`line_user_id`) REFERENCES `line_users` (`line_user_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD UNIQUE KEY `idx_link_code` (`link_code`);

-- 3) Create index for line_user_id in reports
ALTER TABLE `reports`
  ADD INDEX `idx_reports_line_user_id` (`line_user_id`);

-- 4) Add trigger to update last_active_at when line_user_id is linked to report
DROP TRIGGER IF EXISTS `tr_reports_line_user_link`;
DELIMITER $$
CREATE TRIGGER `tr_reports_line_user_link`
AFTER UPDATE ON `reports`
FOR EACH ROW
BEGIN
  IF OLD.line_user_id IS NULL AND NEW.line_user_id IS NOT NULL THEN
    UPDATE `line_users`
    SET `last_active_at` = NOW()
    WHERE `line_user_id` = NEW.line_user_id;
  END IF;
END$$
DELIMITER ;

-- 5) Add tracking_token column to reports for LIFF linking security
ALTER TABLE `reports`
  ADD COLUMN `tracking_token` varchar(64) DEFAULT NULL AFTER `line_user_id`,
  ADD INDEX `idx_reports_tracking_token` (`tracking_token`);

-- 6) Create system settings for LINE integration
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `category`, `description`, `is_public`) VALUES
('line_liff_url', 'https://liff.line.me/{liff-id}', 'line_integration', 'LIFF URL สำหรับผูกคำร้องกับ LINE', false),
('line_notification_enabled', 'true', 'line_integration', 'เปิดใช้งานการส่งแจ้งเตือนผ่าน LINE', false),
('line_download_base_url', '/api/reports/download/', 'line_integration', 'Base URL สำหรับดาวน์โหลดไฟล์ผ่าน LINE', false),
('line_qr_code_url', 'https://lin.ee/UFqUdB6', 'line_integration', 'URL สำหรับเพิ่มเพื่อน LINE OA', true);
