-- Migration: 022_add_timezone_to_organizations
-- Description: Add an IANA-named timezone to organizations so date filters
--              and displayed timestamps can be converted correctly per
--              organization (Chile observes DST, so a fixed numeric offset
--              is never correct). Storage of created_at/opened_at columns
--              stays UTC everywhere - this column only drives conversion at
--              the edges (query filter bounds, display formatting).
--              NOT NULL with a default backfills every existing row to
--              America/Santiago, which is the intended bug fix: today's
--              date filters silently compare against UTC calendar days
--              instead of the org's real business day.

ALTER TABLE `organizations`
    ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Santiago'
        COMMENT 'IANA timezone identifier, e.g. America/Santiago'
        AFTER `active`;
