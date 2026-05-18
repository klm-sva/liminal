-- ── Migration 0004: LEED occupant counts ─────────────────────────────────────
--
-- Adds regular_occupants and peak_visitors to the projects table.
-- These are owner-entered values matching what the project team inputs at
-- LEED Online registration. They are required for nearly every LEED credit
-- calculation (bicycle storage, shower counts, water use, etc.) and cannot
-- be reliably extracted from construction drawings.
--
-- Collected at project creation and stored here so the pipeline never has
-- to estimate them or bounce the question back to the owner mid-credit.

alter table projects
  add column if not exists regular_occupants integer,
  add column if not exists peak_visitors     integer;

comment on column projects.regular_occupants is 'Full-time equivalent regular occupants (students + staff + residents). Matches LEED Online registration data.';
comment on column projects.peak_visitors     is 'Maximum peak visitors at any one time. Matches LEED Online registration data.';
