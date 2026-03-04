-- Migration: 008_create_material_events_table
-- Description: Create material_events table to record granular interaction events

CREATE TABLE IF NOT EXISTS `material_events` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `material_view_id` INT UNSIGNED NOT NULL COMMENT 'Parent view session',
    `material_id`      INT UNSIGNED NOT NULL,
    `event_type`       ENUM(
                           'open',
                           'close',
                           'progress',
                           'outbound_click'
                       ) NOT NULL,
    `event_value`      VARCHAR(255) NULL COMMENT 'e.g. percentage for progress, URL for outbound_click',
    `occurred_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_material_events_view` FOREIGN KEY (`material_view_id`)
        REFERENCES `material_views` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_material_events_material` FOREIGN KEY (`material_id`)
        REFERENCES `materials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_material_events_view` (`material_view_id`),
    INDEX `idx_material_events_material` (`material_id`),
    INDEX `idx_material_events_type` (`event_type`),
    INDEX `idx_material_events_occurred_at` (`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
