-- Migration: Add location coordinate fields to reports table
-- สำหรับฟีเจอร์ "กำหนดพิกัดเหตุการณ์" และ Heatmap

-- 1. Add location columns
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) NULL COMMENT 'พิกัดละติจูด',
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL COMMENT 'พิกัดลองจิจูด',
ADD COLUMN IF NOT EXISTS location_verified_by INT NULL COMMENT 'เจ้าหน้าที่ที่ยืนยันพิกัด (officer_id)',
ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMP NULL COMMENT 'เวลาที่ยืนยันพิกัด';

-- 2. Add indexes for Heatmap API performance
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_location_created ON reports(latitude, longitude, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_location_category ON reports(latitude, longitude, category_id);

-- 3. Add index for status filtering (commonly used)
CREATE INDEX IF NOT EXISTS idx_reports_status_location ON reports(status, latitude, longitude);

-- Add foreign key constraint (optional - uncomment if needed)
-- ALTER TABLE reports
-- ADD CONSTRAINT fk_location_verified_by 
-- FOREIGN KEY (location_verified_by) REFERENCES officers(officer_id);
