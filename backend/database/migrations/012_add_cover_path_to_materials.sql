-- Migration: 012_add_cover_path_to_materials
-- Description: Add cover_path column to materials table

ALTER TABLE `materials` ADD COLUMN `cover_path` VARCHAR(500) NULL AFTER `description`;
