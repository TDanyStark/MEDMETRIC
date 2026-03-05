-- Script para resetear la base de datos
-- Ejecutar esto antes de correr las migraciones para empezar desde cero

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `material_views`;
DROP TABLE IF EXISTS `visit_session_materials`;
DROP TABLE IF EXISTS `visit_sessions`;
DROP TABLE IF EXISTS `rep_manager_access`;
DROP TABLE IF EXISTS `manager_brands`;
DROP TABLE IF EXISTS `materials`;
DROP TABLE IF EXISTS `brands`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `organizations`;

SET FOREIGN_KEY_CHECKS = 1;

-- Resetear auto-increments
-- Nota: Los auto-increments se reiniciarán automáticamente al crear nuevas tablas
