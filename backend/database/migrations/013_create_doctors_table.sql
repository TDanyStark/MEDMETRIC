-- Migration: 013_create_doctors_table
-- Description: Create doctors table (medical doctor directory). Doctors can be
--              imported idempotently from an external Kardex system (via
--              external_id) or created manually by org_admin/manager/rep.

CREATE TABLE IF NOT EXISTS `doctors` (
    `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id`   INT UNSIGNED NOT NULL,
    `external_id`       VARCHAR(30)  NULL COMMENT 'ID from source Kardex system, used for idempotent import',
    `name`              VARCHAR(150) NOT NULL,
    `document`          VARCHAR(50)  NULL,
    `specialty`         VARCHAR(100) NULL,
    `country`           VARCHAR(100) NULL,
    `region`            VARCHAR(100) NULL,
    `provincia`         VARCHAR(100) NULL,
    `comuna`            VARCHAR(100) NULL,
    `institution`       VARCHAR(180) NULL,
    `category`          VARCHAR(20)  NULL,
    `last_visit_date`   DATE         NULL,
    `product`           VARCHAR(255) NULL,
    `adoption_level`    VARCHAR(50)  NULL,
    `assigned_rep_id`   INT UNSIGNED NULL COMMENT 'Rep primarily responsible for this doctor',
    `email`             VARCHAR(255) NULL,
    `phone`             VARCHAR(50)  NULL,
    `mobile_phone`      VARCHAR(50)  NULL,
    `address`           TEXT         NULL,
    `created_by_id`     INT UNSIGNED NULL COMMENT 'User who manually created this doctor (NULL if imported)',
    `active`            TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_doctors_org_external` (`organization_id`, `external_id`),
    CONSTRAINT `fk_doctors_organization` FOREIGN KEY (`organization_id`)
        REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_doctors_assigned_rep` FOREIGN KEY (`assigned_rep_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_doctors_created_by` FOREIGN KEY (`created_by_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_doctors_org` (`organization_id`),
    INDEX `idx_doctors_name` (`name`),
    INDEX `idx_doctors_rep` (`assigned_rep_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
