-- Phase 4a: owner / administrator roles (remap legacy admin / user)
-- Keeps legacy enum values for backward compat; bridges has_role until Batch 4d RLS update.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrator';

UPDATE public.user_roles
SET role = 'owner'::public.app_role
WHERE role = 'admin'::public.app_role;

UPDATE public.user_roles
SET role = 'administrator'::public.app_role
WHERE role = 'user'::public.app_role;

-- Bridge: existing RLS policies still check 'admin' / 'user' (Batch 4d will update policies).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'owner'::public.app_role)
        OR (_role = 'user'::public.app_role AND role = 'administrator'::public.app_role)
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'owner'::public.app_role)
        OR (_role = 'user'::public.app_role AND role = 'administrator'::public.app_role)
      )
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;
