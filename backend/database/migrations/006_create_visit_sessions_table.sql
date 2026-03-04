-- Migration: 006_create_visit_sessions_table
-- Description: Create visit_sessions table for rep-to-doctor visit tracking.
--              A session is not bound to a single manager: the rep may present
--              materials from any of their subscribed managers in a single visit.
--              The specific materials shown are tracked via material_views.

CREATE TABLE IF NOT EXISTS `visit_sessions` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `rep_id`          INT UNSIGNED NOT NULL COMMENT 'Visitador medico (rep) who created the session',
    `doctor_token`    VARCHAR(128) NOT NULL COMMENT 'Unique token for public doctor access (no expiry in MVP)',
    `doctor_name`     VARCHAR(150) NULL COMMENT 'Optional: doctor name recorded by rep',
    `notes`           TEXT         NULL,
    `active`          TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_visit_sessions_token` (`doctor_token`),
    CONSTRAINT `fk_visit_sessions_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_visit_sessions_rep` FOREIGN KEY (`rep_id`)
        REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_visit_sessions_rep` (`rep_id`),
    INDEX `idx_visit_sessions_token` (`doctor_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
