-- RC4: multiple access credentials per project (JSON array)
ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS access_credentials JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.project_notes.access_credentials IS
  'Array of credential objects: {id, label, url, login, password, note}';

-- Backfill legacy single-field credentials into first row
UPDATE public.project_notes
SET access_credentials = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'label', 'Hlavný prístup',
    'url', COALESCE(NULLIF(trim(url), ''), ''),
    'login', COALESCE(NULLIF(trim(username), ''), ''),
    'password', COALESCE(NULLIF(trim(password), ''), ''),
    'note', ''
  )
)
WHERE jsonb_array_length(access_credentials) = 0
  AND (
    NULLIF(trim(url), '') IS NOT NULL
    OR NULLIF(trim(username), '') IS NOT NULL
    OR NULLIF(trim(password), '') IS NOT NULL
  );
