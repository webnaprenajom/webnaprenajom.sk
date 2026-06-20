
-- Grant admin role to maros@salelogics.sk (only when auth user already exists — safe on remote reset)
INSERT INTO public.user_roles (user_id, role)
SELECT 'c4d428dd-a601-4134-9c8c-bb8198c2f2d6', 'admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'c4d428dd-a601-4134-9c8c-bb8198c2f2d6')
ON CONFLICT (user_id, role) DO NOTHING;

-- Password reset removed: breaks fresh remote reset (auth.users empty). Use Dashboard or grant_crm_owner_by_email.
