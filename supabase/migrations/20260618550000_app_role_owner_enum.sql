DO list
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'owner'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
END list;

DO list
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'administrator'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'administrator';
  END IF;
END list;
