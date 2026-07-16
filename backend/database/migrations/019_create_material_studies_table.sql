-- Migration: 019_create_material_studies_table
-- Description: Create material_studies table — supplementary evidence (PDF or
--              external link) attached to a material. Studies have no
--              organization/brand/manager/status fields of their own: scope
--              and approval state are always derived from the parent material.
--              CASCADE-owned by the material (unlike materials' own
--              org/brand/manager FKs, which are RESTRICT).

CREATE TABLE IF NOT EXISTS `material_studies` (
    `id`                          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `material_id`                 INT UNSIGNED  NOT NULL,
    `title`                       VARCHAR(255)  NOT NULL,
    `type`                        ENUM('pdf','link') NOT NULL,
    `storage_driver`              ENUM('local','s3') NOT NULL DEFAULT 'local',
    `storage_path`                VARCHAR(500)  NULL COMMENT 'Relative path for local/S3 stored files (PDF)',
    `external_url`                VARCHAR(2000) NULL COMMENT 'External link URL',
    `pdf_compression_status`      ENUM('pending','compressed','skipped','failed','unavailable') NULL DEFAULT NULL,
    `pdf_compression_error`       VARCHAR(255)  NULL DEFAULT NULL,
    `pdf_compression_checked_at`  DATETIME      NULL DEFAULT NULL,
    `created_at`                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_material_studies_material` FOREIGN KEY (`material_id`)
        REFERENCES `materials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_material_studies_material` (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
