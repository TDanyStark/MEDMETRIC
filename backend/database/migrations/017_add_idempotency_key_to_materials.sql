-- Migration: 017_add_idempotency_key_to_materials
-- Description: Add idempotency_key to materials to prevent duplicate creation
--              when a client retries a request that timed out on the gateway
--              (e.g. Hostinger's fixed shared-hosting proxy timeout) but had
--              already succeeded on the backend.

ALTER TABLE `materials` ADD COLUMN `idempotency_key` VARCHAR(64) NULL AFTER `external_url`;
ALTER TABLE `materials` ADD UNIQUE KEY `uq_materials_idempotency_key` (`idempotency_key`);
