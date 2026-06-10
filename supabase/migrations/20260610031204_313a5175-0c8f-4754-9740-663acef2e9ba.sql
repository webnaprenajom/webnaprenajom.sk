
-- Grant admin role to maros@salelogics.sk
INSERT INTO public.user_roles (user_id, role)
VALUES ('c4d428dd-a601-4134-9c8c-bb8198c2f2d6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Reset password to temporary value (user must change after login)
UPDATE auth.users
SET encrypted_password = crypt('TempReset!2026', gen_salt('bf')),
    updated_at = now()
WHERE id = 'c4d428dd-a601-4134-9c8c-bb8198c2f2d6';
