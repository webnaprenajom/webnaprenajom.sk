-- RC2: add AI as project platform type

ALTER TABLE public.project_notes
  DROP CONSTRAINT IF EXISTS project_notes_project_type_check;

ALTER TABLE public.project_notes
  ADD CONSTRAINT project_notes_project_type_check
  CHECK (project_type IS NULL OR project_type IN ('wordpress', 'shoptet', 'custom', 'other', 'ai'));
