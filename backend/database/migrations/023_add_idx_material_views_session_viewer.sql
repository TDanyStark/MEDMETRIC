-- Migration: 023_add_idx_material_views_session_viewer
-- Description: Composite index on material_views(visit_session_id, viewer_type)
--              to speed up the rep-scoped metrics module (sdd/rep-metrics-module),
--              which repeatedly filters/joins on "doctor views for this session"
--              (EXISTS / antijoin / LEFT JOIN aggregate patterns) across summary,
--              open-trend, hour-histogram, top-materials and sessions queries.
--              Additive only — no data/column changes.

CREATE INDEX `idx_mv_session_viewer` ON `material_views` (`visit_session_id`, `viewer_type`);
