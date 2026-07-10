-- Migration: 014_add_doctor_id_to_visit_sessions
-- Description: Link visit_sessions to the canonical doctors table.
--              `doctor_name` is kept untouched as a legacy snapshot value
--              (captured at the time the session was created), so existing
--              queries/joins that read doctor_name keep working unmodified.

ALTER TABLE `visit_sessions`
    ADD COLUMN `doctor_id` INT UNSIGNED NULL AFTER `doctor_token`;

ALTER TABLE `visit_sessions`
    ADD CONSTRAINT `fk_visit_sessions_doctor` FOREIGN KEY (`doctor_id`)
        REFERENCES `doctors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `visit_sessions`
    ADD INDEX `idx_visit_sessions_doctor` (`doctor_id`);
