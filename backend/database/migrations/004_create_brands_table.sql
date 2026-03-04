-- Migration: 004_create_brands_table
-- Description: Create brands table, owned by organization and managed by a manager

CREATE TABLE IF NOT EXISTS `brands` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `manager_id`      INT UNSIGNED NOT NULL COMMENT 'User with role manager who owns this brand',
    `name`            VARCHAR(150) NOT NULL,
    `description`     TEXT         NULL,
    `active`          TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_brands_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_brands_manager` FOREIGN KEY (`manager_id`)
        REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
