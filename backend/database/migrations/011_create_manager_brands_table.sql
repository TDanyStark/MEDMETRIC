-- Migration: 011_create_manager_brands_table
-- Description: Many-to-many relationship between managers and brands
--              A manager can have many brands, a brand can have many managers
--              This replaces the old manager_id in brands table

CREATE TABLE IF NOT EXISTS `manager_brands` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `manager_id`  INT UNSIGNED NOT NULL COMMENT 'User with role manager',
    `brand_id`    INT UNSIGNED NOT NULL COMMENT 'Brand from brands table',
    `active`      TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_manager_brand` (`manager_id`, `brand_id`),
    CONSTRAINT `fk_mb_manager` FOREIGN KEY (`manager_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mb_brand` FOREIGN KEY (`brand_id`)
        REFERENCES `brands` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_mb_manager` (`manager_id`),
    INDEX `idx_mb_brand` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
