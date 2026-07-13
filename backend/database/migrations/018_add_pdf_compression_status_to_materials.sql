-- Migration: 018_add_pdf_compression_status_to_materials
-- Description: Track the outcome of the background GhostScript PDF
--              compression (see BackgroundProcessLauncher /
--              bin/compress_material.php) so it can be audited/queried
--              directly, e.g. to find materials that never got compressed.
--
--   pending     -> PDF uploaded, background compression launched, not done yet
--   compressed  -> background job replaced the file with a smaller one
--   skipped     -> job ran but there was nothing to gain (GhostScript
--                  unavailable/fallback copy, or compressed size >= original)
--   failed      -> an exception occurred during compression/upload
--   unavailable -> exec() isn't available on this environment at all, so
--                  the background job could never be launched
--   NULL        -> not applicable (non-PDF material) or created before this
--                  tracking existed (legacy, unknown status)

ALTER TABLE `materials`
  ADD COLUMN `pdf_compression_status` ENUM('pending','compressed','skipped','failed','unavailable') NULL DEFAULT NULL AFTER `storage_path`,
  ADD COLUMN `pdf_compression_error` VARCHAR(255) NULL DEFAULT NULL AFTER `pdf_compression_status`,
  ADD COLUMN `pdf_compression_checked_at` DATETIME NULL DEFAULT NULL AFTER `pdf_compression_error`;
