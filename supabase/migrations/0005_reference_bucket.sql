-- ============================================================
-- Liminal — Platform Reference Storage Bucket
-- Creates a private bucket for LEED/WELL reference files
-- that the pipeline reads at runtime.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-reference',
  'platform-reference',
  false,
  52428800,  -- 50 MB per file
  array[
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'text/markdown',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Service role only — no public access, no customer access
create policy "service_role_only_reference"
  on storage.objects for all
  using (
    bucket_id = 'platform-reference'
    and auth.role() = 'service_role'
  );
