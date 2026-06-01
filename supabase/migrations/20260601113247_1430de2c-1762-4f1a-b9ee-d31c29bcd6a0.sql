
-- Helper: do two users share at least one project (as member or manager)?
CREATE OR REPLACE FUNCTION public.users_share_project(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = _a AND pm2.user_id = _b
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.manager_id = _a
      AND (p.created_by = _b OR p.manager_id = _b
           OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = _b))
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.manager_id = _b
      AND EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = _a)
  );
$$;

-- ===== profiles SELECT: restrict =====
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins see all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project collaborators see each other" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.users_share_project(auth.uid(), id));

-- ===== project_members SELECT: restrict =====
DROP POLICY IF EXISTS "Members see own memberships" ON public.project_members;

CREATE POLICY "Members see own memberships" ON public.project_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers see project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (public.is_project_manager(auth.uid(), project_id));

-- (Admins already covered by "Admins manage members" ALL policy)

-- ===== user_roles: explicit deny for non-admin writes via admin-only ALL policy =====
-- Add admin-managed write policies; absence of any other INSERT/UPDATE/DELETE
-- policy means non-admins are denied by default.
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===== Fix mutable search_path on trigger function =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
