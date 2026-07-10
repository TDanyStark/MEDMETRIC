-- Migration: 016_alter_visit_session_materials_fk_cascade
-- Description: Change fk_vsm_material on visit_session_materials from ON DELETE RESTRICT
--              to ON DELETE CASCADE, so deleting a material also removes its references
--              from visit sessions instead of blocking the delete with a FK violation.

ALTER TABLE `visit_session_materials` DROP FOREIGN KEY `fk_vsm_material`;

ALTER TABLE `visit_session_materials` ADD CONSTRAINT `fk_vsm_material` FOREIGN KEY (`material_id`)
    REFERENCES `materials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
