-- Migration: 010_create_visit_session_materials_table
-- Description: Defines which specific materials the rep included in a visit session.
--              The doctor only sees these materials when accessing via doctor_token.
--              The rep selects materials from their approved feed when creating the session.

CREATE TABLE IF NOT EXISTS `visit_session_materials` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `visit_session_id` INT UNSIGNED NOT NULL,
    `material_id`      INT UNSIGNED NOT NULL,
    `sort_order`       SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Display order in the session feed',
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_vsm_session_material` (`visit_session_id`, `material_id`),
    CONSTRAINT `fk_vsm_session` FOREIGN KEY (`visit_session_id`)
        REFERENCES `visit_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_vsm_material` FOREIGN KEY (`material_id`)
        REFERENCES `materials` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_vsm_session` (`visit_session_id`),
    INDEX `idx_vsm_material` (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
