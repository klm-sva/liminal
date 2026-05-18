-- Track which document profile types have been extracted for each project
alter table projects
  add column if not exists doc_profiles_extracted jsonb not null default '{}';

-- Helper function used by document-extract.ts to atomically set a type flag
create or replace function append_doc_profile_type(project_id uuid, doc_type text)
returns void language sql as $$
  update projects
  set doc_profiles_extracted = doc_profiles_extracted || jsonb_build_object(doc_type, true)
  where id = project_id;
$$;
