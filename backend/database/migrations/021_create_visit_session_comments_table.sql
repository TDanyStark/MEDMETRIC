-- Migration: 021_create_visit_session_comments_table
-- Description: Create visit_session_comments table so doctors (public, via
--              session token) and reps (authenticated) can leave comments on
--              a visit session, optionally scoped to one material of that
--              session. org_admin/manager/rep browse a role-scoped list;
--              superadmin is excluded from this feature.
--              `parent_id` is included for future threading (dormant in the
--              MVP — never written, never exposed in the API).
--              `material_id` targets `materials.id` (NOT
--              `visit_session_materials.id`) so a comment survives a rep
--              editing the session's material selection (addMaterials()
--              diff-delete must not cascade-delete comments).

CREATE TABLE IF NOT EXISTS `visit_session_comments` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `visit_session_id` INT UNSIGNED NOT NULL,
    `material_id`      INT UNSIGNED NULL COMMENT 'NULL = open/general comment',
    `organization_id`  INT UNSIGNED NOT NULL COMMENT 'Denormalized from visit_sessions for org-scoped reads',
    `parent_id`        INT UNSIGNED NULL COMMENT 'Future threading, unused in MVP',
    `author_type`      ENUM('doctor','rep') NOT NULL,
    `author_user_id`   INT UNSIGNED NULL COMMENT 'rep user id (from JWT), NULL for doctor',
    `doctor_id`        INT UNSIGNED NULL COMMENT 'derived from visit_sessions.doctor_id, NULL for rep',
    `body`             TEXT NOT NULL,
    `user_agent`       VARCHAR(500) NULL,
    `ip_address`       VARCHAR(45) NULL,
    `active`           TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'soft-delete flag',
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_vsc_session` FOREIGN KEY (`visit_session_id`)
        REFERENCES `visit_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_vsc_material` FOREIGN KEY (`material_id`)
        REFERENCES `materials` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_vsc_org` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_vsc_parent` FOREIGN KEY (`parent_id`)
        REFERENCES `visit_session_comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_vsc_author` FOREIGN KEY (`author_user_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_vsc_doctor` FOREIGN KEY (`doctor_id`)
        REFERENCES `doctors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_vsc_org` (`organization_id`, `active`, `created_at`),
    INDEX `idx_vsc_session` (`visit_session_id`, `active`),
    INDEX `idx_vsc_material` (`material_id`),
    INDEX `idx_vsc_author_user` (`author_user_id`),
    INDEX `idx_vsc_doctor` (`doctor_id`),
    INDEX `idx_vsc_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
