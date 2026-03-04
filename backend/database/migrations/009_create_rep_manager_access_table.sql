-- Migration: 009_create_rep_manager_access_table
-- Description: Defines which managers a rep is subscribed to within an organization.
--              A rep can be subscribed to one or many managers.
--              A manager can subscribe one or many reps.
--              Both must belong to the same organization (enforced at app level).
--              A rep only sees approved materials from their subscribed managers.

CREATE TABLE IF NOT EXISTS `rep_manager_access` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `rep_id`     INT UNSIGNED NOT NULL COMMENT 'User with role rep',
    `manager_id` INT UNSIGNED NOT NULL COMMENT 'User with role manager',
    `active`     TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_rep_manager` (`rep_id`, `manager_id`),
    CONSTRAINT `fk_rma_rep` FOREIGN KEY (`rep_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_rma_manager` FOREIGN KEY (`manager_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_rma_rep` (`rep_id`),
    INDEX `idx_rma_manager` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
