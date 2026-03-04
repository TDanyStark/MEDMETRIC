-- Migration: 007_create_material_views_table
-- Description: Create material_views table to track who viewed each material and when

CREATE TABLE IF NOT EXISTS `material_views` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `material_id`      INT UNSIGNED NOT NULL,
    `visit_session_id` INT UNSIGNED NULL COMMENT 'NULL if viewed directly by rep without a session',
    `viewer_type`      ENUM('rep','doctor') NOT NULL,
    `viewer_id`        INT UNSIGNED NULL COMMENT 'User id for rep - NULL for doctor (no auth)',
    `opened_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `closed_at`        DATETIME     NULL,
    `duration_seconds` INT UNSIGNED NULL COMMENT 'Calculated on close: closed_at - opened_at',
    `user_agent`       VARCHAR(500) NULL,
    `ip_address`       VARCHAR(45)  NULL COMMENT 'IPv4 or IPv6',
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_material_views_material` FOREIGN KEY (`material_id`)
        REFERENCES `materials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_material_views_session` FOREIGN KEY (`visit_session_id`)
        REFERENCES `visit_sessions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_material_views_viewer` FOREIGN KEY (`viewer_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_material_views_material` (`material_id`),
    INDEX `idx_material_views_session` (`visit_session_id`),
    INDEX `idx_material_views_viewer_type` (`viewer_type`),
    INDEX `idx_material_views_opened_at` (`opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
