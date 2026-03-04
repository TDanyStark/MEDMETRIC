-- Migration: 005_create_materials_table
-- Description: Create materials table for PDF, video (YouTube) and external links

CREATE TABLE IF NOT EXISTS `materials` (
    `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `brand_id`       INT UNSIGNED  NOT NULL,
    `manager_id`     INT UNSIGNED  NOT NULL COMMENT 'Manager who uploaded the material',
    `title`          VARCHAR(255)  NOT NULL,
    `description`    TEXT          NULL,
    `type`           ENUM('pdf','video','link') NOT NULL,
    `status`         ENUM('draft','approved','archived') NOT NULL DEFAULT 'draft',
    `storage_driver` ENUM('local','s3') NOT NULL DEFAULT 'local',
    `storage_path`   VARCHAR(500)  NULL COMMENT 'Relative path for local/S3 stored files (PDF)',
    `external_url`   VARCHAR(2000) NULL COMMENT 'YouTube URL or external link URL',
    `approved_at`    DATETIME      NULL,
    `approved_by`    INT UNSIGNED  NULL COMMENT 'User id who approved the material',
    `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_materials_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_materials_brand` FOREIGN KEY (`brand_id`)
        REFERENCES `brands` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_materials_manager` FOREIGN KEY (`manager_id`)
        REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_materials_approved_by` FOREIGN KEY (`approved_by`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_materials_status` (`status`),
    INDEX `idx_materials_type` (`type`),
    INDEX `idx_materials_organization_status` (`organization_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
