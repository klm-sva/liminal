-- ============================================================
-- Fix: customer-uploads bucket rejects application/json
--
-- document-extract.ts, specs-extract.ts, and drawing-analysis.ts all
-- store internally-generated JSON profiles (doc-profiles/*.json,
-- specs-profile.json, project-profile.json) in the customer-uploads
-- bucket. The bucket's allowed_mime_types never included
-- application/json, so every one of those uploads was rejected with
-- "mime type application/json is not supported" — silently for the
-- try/catch-wrapped call sites, fatally (uncaught) for
-- drawing-analysis.ts's project-profile.json upload.
-- ============================================================

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/json')
where id = 'customer-uploads'
  and not ('application/json' = any(allowed_mime_types));
