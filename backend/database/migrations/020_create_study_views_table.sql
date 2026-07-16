-- Migration: 020_create_study_views_table
-- Description: Create study_views table to track who viewed each material
--              study and when. Mirrors material_views, but scoped to
--              material_studies and without closed_at/duration_seconds —
--              studies don't track view duration (explicit decision).

CREATE TABLE IF NOT EXISTS `study_views` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `study_id`         INT UNSIGNED NOT NULL,
    `visit_session_id` INT UNSIGNED NULL COMMENT 'NULL if viewed directly by rep without a session',
    `viewer_type`      ENUM('rep','doctor') NOT NULL,
    `viewer_id`        INT UNSIGNED NULL COMMENT 'User id for rep - NULL for doctor (no auth)',
    `opened_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `user_agent`       VARCHAR(500) NULL,
    `ip_address`       VARCHAR(45)  NULL COMMENT 'IPv4 or IPv6',
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_study_views_study` FOREIGN KEY (`study_id`)
        REFERENCES `material_studies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_study_views_session` FOREIGN KEY (`visit_session_id`)
        REFERENCES `visit_sessions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_study_views_viewer` FOREIGN KEY (`viewer_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_study_views_study` (`study_id`),
    INDEX `idx_study_views_session` (`visit_session_id`),
    INDEX `idx_study_views_viewer_type` (`viewer_type`),
    INDEX `idx_study_views_opened_at` (`opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
