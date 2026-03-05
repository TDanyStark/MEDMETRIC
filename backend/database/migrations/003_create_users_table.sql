-- Migration: 003_create_users_table
-- Description: Create users table with role and organization references.
--              Reps belong to an organization only. Their access to specific
--              managers is defined in the rep_manager_access table (migration 009).
--              Superadmin has organization_id NULL (access to all organizations).
--              Org admins, managers and reps must belong to an organization.

CREATE TABLE IF NOT EXISTS `users` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NULL,
    `role_id`         INT UNSIGNED NOT NULL,
    `name`            VARCHAR(150) NOT NULL,
    `email`           VARCHAR(255) NOT NULL,
    `password_hash`   VARCHAR(255) NOT NULL,
    `active`          TINYINT(1)   NOT NULL DEFAULT 1,
    `last_login_at`   DATETIME     NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    CONSTRAINT `fk_users_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`)
        REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
