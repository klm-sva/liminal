-- Migration 0006: specs_extracted flag on projects
--
-- Tracks whether spec documents uploaded for a project have been
-- pre-extracted into a compact specs-profile.json. Mirrors auto_extracted
-- for drawings. Set to true after specs-extract.ts completes successfully.

alter table projects
  add column if not exists specs_extracted boolean not null default false;

comment on column projects.specs_extracted is
  'True when uploaded spec documents have been pre-extracted into specs-profile.json in Storage.';
