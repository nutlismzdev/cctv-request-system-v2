-- Add language field to reports table
-- Migration for existing database

ALTER TABLE `reports`
ADD COLUMN `language` enum('th','en') DEFAULT 'th' AFTER `postal_code`;
