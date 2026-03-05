-- Migration: 004_create_brands_table
-- Description: Create brands table as catalog master (no manager_id, admin managed)
--              Unique by organization + name (no duplicates like 3 "Bellaface" in same org)

CREATE TABLE IF NOT EXISTS `brands` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `name`            VARCHAR(150) NOT NULL,
    `description`     TEXT         NULL,
    `active`          TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_brand_org_name` (`organization_id`, `name`),
    CONSTRAINT `fk_brands_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
