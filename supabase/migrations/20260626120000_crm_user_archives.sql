-- Batch B: safe CRM user removal — archive active identity, preserve business history.

CREATE TABLE IF NOT EXISTS public.crm_user_archives (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  historical_implementer_name TEXT,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by_user_id UUID
);

COMMENT ON TABLE public.crm_user_archives IS
  'CRM users removed from active management. Business references stay; identity shown as historical.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_user_archives TO authenticated;
GRANT ALL ON public.crm_user_archives TO service_role;

CREATE INDEX IF NOT EXISTS crm_user_archives_removed_at_idx
  ON public.crm_user_archives (removed_at DESC);

CREATE INDEX IF NOT EXISTS crm_user_archives_implementer_idx
  ON public.crm_user_archives (historical_implementer_name)
  WHERE historical_implementer_name IS NOT NULL;

ALTER TABLE public.crm_user_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_crm_user_archives" ON public.crm_user_archives;
CREATE POLICY "owner_read_crm_user_archives"
  ON public.crm_user_archives FOR SELECT TO authenticated
  USING (public.is_crm_owner());

DROP POLICY IF EXISTS "owner_manage_crm_user_archives" ON public.crm_user_archives;
CREATE POLICY "owner_manage_crm_user_archives"
  ON public.crm_user_archives FOR ALL TO authenticated
  USING (public.is_crm_owner())
  WITH CHECK (public.is_crm_owner());

CREATE OR REPLACE FUNCTION public.owner_remove_crm_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT;
  v_auth_name TEXT;
  v_role TEXT;
  v_owner_count INT;
  v_profile public.team_profiles%ROWTYPE;
  v_implementer TEXT;
  v_display TEXT;
  v_archived_impl TEXT;
  v_uid_suffix TEXT;
BEGIN
  IF NOT public.is_crm_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.crm_user_archives WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Používateľ je už odstránený z CRM';
  END IF;

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_target_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Používateľ nemá CRM rolu';
  END IF;

  IF v_role = 'owner' THEN
    SELECT COUNT(*)::INT INTO v_owner_count FROM public.user_roles WHERE role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Nemožno odstrániť posledného ownera';
    END IF;
  END IF;

  SELECT u.email::TEXT,
    COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
    )
  INTO v_email, v_auth_name
  FROM auth.users u
  WHERE u.id = p_target_user_id;

  SELECT * INTO v_profile
  FROM public.team_profiles
  WHERE user_id = p_target_user_id;

  v_implementer := NULL;
  IF v_profile.user_id IS NOT NULL THEN
    IF v_profile.implementer_name LIKE '%__off__%' THEN
      v_implementer := NULLIF(TRIM(split_part(v_profile.implementer_name, '__off__', 1)), '');
    ELSE
      v_implementer := NULLIF(TRIM(v_profile.implementer_name), '');
    END IF;
  END IF;

  v_display := COALESCE(
    NULLIF(TRIM(v_profile.display_name), ''),
    NULLIF(TRIM(v_auth_name), ''),
    NULLIF(SPLIT_PART(COALESCE(v_email, ''), '@', 1), ''),
    p_target_user_id::TEXT
  );

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;

  v_uid_suffix := REPLACE(SUBSTRING(p_target_user_id::TEXT, 1, 8), '-', '');

  IF v_profile.user_id IS NOT NULL AND v_profile.active AND v_implementer IS NOT NULL THEN
    v_archived_impl := v_implementer || '__off__' || v_uid_suffix;
    UPDATE public.team_profiles
    SET active = false,
        implementer_name = v_archived_impl,
        updated_at = now()
    WHERE user_id = p_target_user_id;
  ELSIF v_profile.user_id IS NOT NULL AND v_profile.active THEN
    UPDATE public.team_profiles
    SET active = false, updated_at = now()
    WHERE user_id = p_target_user_id;
  END IF;

  IF v_implementer IS NOT NULL THEN
    UPDATE public.crm_implementers
    SET active = false
    WHERE lower(trim(name)) = lower(trim(v_implementer));
  END IF;

  INSERT INTO public.crm_user_archives (
    user_id,
    email,
    display_name,
    historical_implementer_name,
    removed_by_user_id
  ) VALUES (
    p_target_user_id,
    COALESCE(v_email, ''),
    v_display,
    v_implementer,
    v_actor
  );

  RETURN jsonb_build_object(
    'user_id', p_target_user_id,
    'display_name', v_display,
    'historical_implementer_name', v_implementer,
    'email', COALESCE(v_email, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_remove_crm_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_remove_crm_user(UUID) TO authenticated;

COMMENT ON FUNCTION public.owner_remove_crm_user IS
  'Owner-only: remove CRM user from active management, archive identity, preserve finance/history.';

NOTIFY pgrst, 'reload schema';
