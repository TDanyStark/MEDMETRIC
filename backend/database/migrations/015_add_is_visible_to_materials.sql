-- Migration: 015_add_is_visible_to_materials
-- Description: Add is_visible column to materials table

ALTER TABLE `materials` ADD COLUMN `is_visible` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`;
UPDATE `materials` SET `is_visible` = 1 WHERE `status` = 'approved';
